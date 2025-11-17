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

  const tagCache = new Map();
  const TAG_CACHE_TTL = 5 * 60 * 1000;
  const MAX_CONCURRENT_TAG_FETCHES = 5;

  async function fetchLatestEventTags(issueId) {
    const cacheKey = `tags:${issueId}`;
    const cached = tagCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < TAG_CACHE_TTL) {
      return cached.tags;
    }

    try {
      const url = `${SENTRY_API_BASE}/organizations/${SENTRY_ORG_SLUG}/issues/${issueId}/events/latest/`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SENTRY_AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`⚠️ Failed to fetch tags for issue ${issueId}: ${response.status}`);
        return {};
      }

      const event = await response.json();
      const tags = event.tags || [];
      
      const enrichmentTags = {
        user_impact: tags.find(t => t.key === 'user_impact')?.value || 'unknown',
        has_retry: tags.find(t => t.key === 'has_retry')?.value === 'yes',
        has_recovery: tags.find(t => t.key === 'has_recovery')?.value === 'yes',
        is_infrastructure: tags.find(t => t.key === 'is_infrastructure')?.value === 'yes',
        is_business_logic: tags.find(t => t.key === 'is_business_logic')?.value === 'yes'
      };

      tagCache.set(cacheKey, {
        tags: enrichmentTags,
        timestamp: Date.now()
      });

      return enrichmentTags;
    } catch (error) {
      console.error(`❌ Error fetching tags for issue ${issueId}:`, error.message);
      return {};
    }
  }

  async function fetchTagsWithConcurrency(issueIds) {
    const results = {};
    const batches = [];
    
    for (let i = 0; i < issueIds.length; i += MAX_CONCURRENT_TAG_FETCHES) {
      batches.push(issueIds.slice(i, i + MAX_CONCURRENT_TAG_FETCHES));
    }

    for (const batch of batches) {
      const promises = batch.map(async (issueId) => {
        const tags = await fetchLatestEventTags(issueId);
        results[issueId] = tags;
      });
      
      await Promise.all(promises);
    }

    return results;
  }

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
      const limitedIssues = issues.slice(0, limit);
      
      console.log(`📊 Fetching enrichment tags for ${limitedIssues.length} issues...`);
      const issueIds = limitedIssues.map(issue => issue.id);
      const tagsMap = await fetchTagsWithConcurrency(issueIds);
      console.log(`✅ Fetched tags for ${Object.keys(tagsMap).length}/${limitedIssues.length} issues`);
      
      const transformedIssues = limitedIssues.map(issue => ({
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
        environment: environment || issue.environment || getEnvironmentFromTags(issue.tags || []),
        enrichmentTags: tagsMap[issue.id] || {}
      }));

      console.log(`✅ Fetched ${transformedIssues.length} Sentry issues with enrichment tags (filtered by: ${query || 'none'})`);

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
   * GET /api/admin/sentry/environments
   * Fetch available environments from Sentry project
   */
  router.get('/sentry/environments', requireAdmin, async (req, res) => {
    try {
      if (!SENTRY_ORG_SLUG || !SENTRY_AUTH_TOKEN) {
        return res.status(503).json({ 
          error: 'Sentry credentials not configured',
          message: 'Please configure SENTRY_ORG_SLUG and SENTRY_AUTH_TOKEN environment variables'
        });
      }

      const url = `${SENTRY_API_BASE}/projects/${SENTRY_ORG_SLUG}/${PROJECT_SLUG}/environments/`;
      
      console.log(`📊 Fetching Sentry environments: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SENTRY_AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Sentry API error (${response.status}):`, errorText);
        
        if (response.status === 404) {
          // No environments configured, return empty array
          return res.json({
            success: true,
            environments: []
          });
        }
        
        throw new Error(`Sentry API error: ${response.status} - ${errorText}`);
      }

      const environments = await response.json();
      
      // Extract environment names
      const environmentNames = environments.map(env => env.name).filter(Boolean);
      
      console.log(`✅ Fetched ${environmentNames.length} Sentry environments:`, environmentNames);

      res.json({
        success: true,
        environments: environmentNames
      });

    } catch (error) {
      console.error('❌ Error fetching Sentry environments:', error);
      Sentry.captureException(error, {
        tags: { service: 'admin-sentry', endpoint: '/api/admin/sentry/environments' }
      });
      res.status(500).json({ 
        error: 'Failed to fetch Sentry environments',
        message: error.message 
      });
    }
  });

  /**
   * GET /api/admin/sentry/current-environment
   * Get the current environment being used for Sentry error tracking
   */
  router.get('/sentry/current-environment', requireAdmin, async (req, res) => {
    try {
      // Return the same environment that Sentry is using
      const currentEnvironment = process.env.NODE_ENV || 'development';
      
      res.json({
        success: true,
        environment: currentEnvironment
      });
    } catch (error) {
      console.error('❌ Error getting current environment:', error);
      res.status(500).json({ 
        error: 'Failed to get current environment',
        message: error.message 
      });
    }
  });

  /**
   * GET /api/admin/sentry/issues/:issueId
   * Fetch detailed information about a specific Sentry issue
   */
  router.get('/sentry/issues/:issueId', requireAdmin, async (req, res) => {
    try {
      if (!SENTRY_ORG_SLUG || !SENTRY_AUTH_TOKEN) {
        return res.status(503).json({ 
          error: 'Sentry credentials not configured',
          message: 'Please configure SENTRY_ORG_SLUG and SENTRY_AUTH_TOKEN environment variables'
        });
      }

      const { issueId } = req.params;
      
      // Build API URL - using organization-level endpoint
      const url = `${SENTRY_API_BASE}/organizations/${SENTRY_ORG_SLUG}/issues/${issueId}/`;
      
      console.log(`📊 Fetching Sentry issue details: ${url}`);

      // Call Sentry API
      const response = await fetch(url, {
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
            message: 'Invalid SENTRY_AUTH_TOKEN'
          });
        }
        
        if (response.status === 404) {
          return res.status(404).json({ 
            error: 'Issue not found',
            message: `Sentry issue "${issueId}" not found.`
          });
        }
        
        throw new Error(`Sentry API error: ${response.status} - ${errorText}`);
      }

      const issue = await response.json();
      
      console.log(`✅ Fetched Sentry issue details for ${issueId}`);

      res.json({
        success: true,
        issue: {
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
          metadata: issue.metadata || {},
          tags: issue.tags || [],
          activity: issue.activity || [],
          annotations: issue.annotations || []
        }
      });

    } catch (error) {
      console.error('❌ Error fetching Sentry issue details:', error);
      Sentry.captureException(error, {
        tags: { service: 'admin-sentry', endpoint: '/api/admin/sentry/issues/:issueId' },
        extra: { issueId: req.params.issueId }
      });
      res.status(500).json({ 
        error: 'Failed to fetch Sentry issue details',
        message: error.message 
      });
    }
  });

  /**
   * GET /api/admin/sentry/issues/:issueId/events/latest
   * Fetch the latest event for a specific issue (includes full error details, stack trace, breadcrumbs)
   */
  router.get('/sentry/issues/:issueId/events/latest', requireAdmin, async (req, res) => {
    try {
      if (!SENTRY_ORG_SLUG || !SENTRY_AUTH_TOKEN) {
        return res.status(503).json({ 
          error: 'Sentry credentials not configured',
          message: 'Please configure SENTRY_ORG_SLUG and SENTRY_AUTH_TOKEN environment variables'
        });
      }

      const { issueId } = req.params;
      
      // Build API URL for latest event
      const url = `${SENTRY_API_BASE}/organizations/${SENTRY_ORG_SLUG}/issues/${issueId}/events/latest/`;
      
      console.log(`📊 Fetching latest event for Sentry issue: ${url}`);

      // Call Sentry API
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SENTRY_AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Sentry API error (${response.status}):`, errorText);
        
        if (response.status === 404) {
          return res.status(404).json({ 
            error: 'Event not found',
            message: `No events found for issue "${issueId}".`
          });
        }
        
        throw new Error(`Sentry API error: ${response.status} - ${errorText}`);
      }

      const event = await response.json();
      
      console.log(`✅ Fetched latest event for issue ${issueId}`);

      res.json({
        success: true,
        event: {
          id: event.id,
          eventID: event.eventID,
          title: event.title,
          message: event.message,
          level: event.level,
          platform: event.platform,
          dateCreated: event.dateCreated,
          culprit: event.culprit,
          tags: event.tags || [],
          context: event.context || {},
          entries: event.entries || [],
          errors: event.errors || [],
          user: event.user || null,
          sdk: event.sdk || {},
          breadcrumbs: event.entries?.find(e => e.type === 'breadcrumbs')?.data?.values || [],
          exception: event.entries?.find(e => e.type === 'exception')?.data?.values || [],
          request: event.entries?.find(e => e.type === 'request')?.data || null
        }
      });

    } catch (error) {
      console.error('❌ Error fetching latest event:', error);
      Sentry.captureException(error, {
        tags: { service: 'admin-sentry', endpoint: '/api/admin/sentry/issues/:issueId/events/latest' },
        extra: { issueId: req.params.issueId }
      });
      res.status(500).json({ 
        error: 'Failed to fetch latest event',
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
