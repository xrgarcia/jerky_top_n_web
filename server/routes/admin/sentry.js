const express = require('express');
const Sentry = require('@sentry/node');

/**
 * Sentry Issue Monitoring Routes
 * Fetch and display Sentry issues for the jerky-rank-ui project
 */
module.exports = function createSentryRoutes(storage) {
  const router = express.Router();

  const SENTRY_API_BASE = 'https://sentry.io/api/0';
  const SENTRY_ORG_SLUG = process.env.SENTRY_ORG_SLUG;
  const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
  const PROJECT_SLUG = 'jerky-rank-ui';

  /**
   * Middleware: Require employee/admin authentication
   */
  async function requireAdmin(req, res, next) {
    try {
      const sessionId = req.cookies.session_id;
      
      if (!sessionId) {
        return res.status(403).json({ error: 'Access denied. Admin authentication required.' });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(403).json({ error: 'Access denied. Invalid session.' });
      }

      const user = await storage.getUserById(session.userId);
      if (!user) {
        return res.status(403).json({ error: 'Access denied. User not found.' });
      }

      // Allow if employee_admin role OR @jerky.com email
      const hasAccess = user.role === 'employee_admin' || (user.email && user.email.endsWith('@jerky.com'));
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      }
      
      req.session = session;
      req.userId = session.userId;
      req.user = user;
      
      next();
    } catch (error) {
      console.error('Error in requireAdmin:', error);
      Sentry.captureException(error, { tags: { service: 'admin-sentry' } });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * GET /api/admin/sentry/issues
   * Fetch Sentry issues for jerky-rank-ui project
   * Query params:
   *  - environment: 'production' | 'development' | 'all' (default: 'all')
   *  - status: 'unresolved' | 'resolved' | 'ignored' | 'all' (default: 'unresolved')
   *  - limit: number (default: 25, max: 100)
   */
  router.get('/sentry/issues', requireAdmin, async (req, res) => {
    try {
      if (!SENTRY_ORG_SLUG || !SENTRY_AUTH_TOKEN) {
        return res.status(503).json({ 
          error: 'Sentry credentials not configured',
          message: 'Please configure SENTRY_ORG_SLUG and SENTRY_AUTH_TOKEN environment variables'
        });
      }

      const environment = req.query.environment || 'all';
      const status = req.query.status || 'unresolved';
      const limit = Math.min(parseInt(req.query.limit) || 25, 100);

      // Build Sentry query
      const queryParts = [];
      
      // Add status filter
      if (status !== 'all') {
        queryParts.push(`is:${status}`);
      }
      
      // Add environment filter
      if (environment !== 'all') {
        queryParts.push(`environment:${environment}`);
      }

      const query = queryParts.length > 0 ? queryParts.join(' ') : undefined;
      
      // Build API URL
      const url = `${SENTRY_API_BASE}/projects/${SENTRY_ORG_SLUG}/${PROJECT_SLUG}/issues/`;
      const params = new URLSearchParams();
      if (query) {
        params.append('query', query);
      }
      params.append('statsPeriod', '14d'); // Last 14 days of stats
      
      const fullUrl = `${url}?${params.toString()}`;
      
      console.log(`📊 Fetching Sentry issues: ${fullUrl}`);

      // Call Sentry API
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SENTRY_AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Sentry API error (${response.status}):`, errorText);
        
        if (response.status === 401) {
          return res.status(503).json({ 
            error: 'Sentry authentication failed',
            message: 'Invalid SENTRY_AUTH_TOKEN. Please regenerate the token with event:read scope.'
          });
        }
        
        if (response.status === 403) {
          return res.status(503).json({ 
            error: 'Sentry access denied',
            message: 'Token does not have event:read permission or access to this project.'
          });
        }
        
        if (response.status === 404) {
          return res.status(404).json({ 
            error: 'Project not found',
            message: `Sentry project "${PROJECT_SLUG}" not found in organization "${SENTRY_ORG_SLUG}".`
          });
        }
        
        throw new Error(`Sentry API error: ${response.status} - ${errorText}`);
      }

      const issues = await response.json();
      
      // Transform issues for frontend consumption
      const transformedIssues = issues.slice(0, limit).map(issue => ({
        id: issue.id,
        shortId: issue.shortId,
        title: issue.title || issue.metadata?.title || 'Untitled Issue',
        culprit: issue.culprit || '',
        level: issue.level || 'error',
        status: issue.status || 'unresolved',
        count: parseInt(issue.count) || 0,
        userCount: parseInt(issue.userCount) || 0,
        firstSeen: issue.firstSeen,
        lastSeen: issue.lastSeen,
        permalink: issue.permalink,
        project: {
          name: issue.project?.name || PROJECT_SLUG,
          slug: issue.project?.slug || PROJECT_SLUG
        },
        metadata: {
          type: issue.metadata?.type || '',
          value: issue.metadata?.value || '',
          filename: issue.metadata?.filename || '',
          function: issue.metadata?.function || ''
        },
        // Extract environment tags
        tags: issue.tags || [],
        environment: getEnvironmentFromTags(issue.tags || [])
      }));

      console.log(`✅ Fetched ${transformedIssues.length} Sentry issues (filtered by: ${query || 'none'})`);

      res.json({
        success: true,
        issues: transformedIssues,
        totalCount: transformedIssues.length,
        filters: {
          environment,
          status,
          limit
        },
        project: {
          slug: PROJECT_SLUG,
          organization: SENTRY_ORG_SLUG
        }
      });

    } catch (error) {
      console.error('❌ Error fetching Sentry issues:', error);
      Sentry.captureException(error, {
        tags: { service: 'admin-sentry', endpoint: '/api/admin/sentry/issues' },
        extra: { 
          environment: req.query.environment,
          status: req.query.status
        }
      });
      res.status(500).json({ 
        error: 'Failed to fetch Sentry issues',
        message: error.message 
      });
    }
  });

  /**
   * Helper: Extract environment from issue tags
   */
  function getEnvironmentFromTags(tags) {
    const envTag = tags.find(tag => tag.key === 'environment');
    return envTag ? envTag.value : 'unknown';
  }

  return router;
};
