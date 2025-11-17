import * as Sentry from '@sentry/react';
import { useAuthStore } from '../store/authStore';

let sentryInitialized = false;
let errorQueue = [];

export async function initializeSentry() {
  if (sentryInitialized) {
    return;
  }

  try {
    const response = await fetch('/api/config');
    const config = await response.json();

    if (!config.sentryDsn) {
      console.warn('⚠️  Sentry DSN not configured - frontend error tracking disabled');
      return;
    }

    Sentry.init({
      dsn: config.sentryDsn,
      environment: config.environment || 'development',
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
      tracesSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      
      beforeSend(event, hint) {
        const error = hint?.originalException;
        const errorMessage = error?.message || event.message || '';
        
        const ignorePatterns = [
          /Network request failed/i,
          /Failed to fetch/i,
          /Load failed/i,
          /cancelled/i,
          /^null$/,
          /^undefined$/,
          /ResizeObserver loop/i,
          /Non-Error promise rejection/i,
        ];
        
        if (ignorePatterns.some(pattern => pattern.test(errorMessage))) {
          console.log('🔇 Sentry: Filtered out benign frontend error:', errorMessage);
          return null;
        }
        
        const warningPatterns = [
          /Request timeout/i,
          /Slow network/i,
        ];
        
        if (warningPatterns.some(pattern => pattern.test(errorMessage))) {
          event.level = 'warning';
        }
        
        if (!event.tags) event.tags = {};
        event.tags.is_frontend = true;
        
        const isUserAction = event.breadcrumbs?.some(bc => 
          bc.category === 'ui.click' || bc.category === 'ui.input'
        );
        event.tags.user_triggered = isUserAction;
        
        return event;
      },
    });

    sentryInitialized = true;
    console.log(`✅ Sentry error tracking initialized (${config.environment})`);
    
    // Set user context if user is already logged in
    try {
      const { user, userRole } = useAuthStore.getState();
      if (user) {
        setUserContext({ ...user, role: userRole });
        console.log(`🔐 Sentry user context set for user ${user.id}`);
      }
    } catch (err) {
      console.warn('Failed to set initial user context:', err);
    }
    
    // Flush queued errors
    if (errorQueue.length > 0) {
      console.log(`📤 Flushing ${errorQueue.length} queued error(s) to Sentry...`);
      errorQueue.forEach(({ error, context }) => captureError(error, context));
      errorQueue = [];
    }
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
  }
}

export function captureError(error, context = {}) {
  if (!sentryInitialized) {
    console.error('Error (Sentry not initialized, queuing):', error, context);
    errorQueue.push({ error, context });
    return;
  }

  const { page, user, operation, result, message, ...extraContext } = context;

  Sentry.captureException(error, {
    tags: {
      page: page || 'unknown',
      operation: operation || 'unknown',
      result: result || 'failure',
    },
    user: user ? {
      id: user.id,
      email: user.email,
      username: user.displayName || `${user.firstName} ${user.lastName}`,
    } : undefined,
    extra: {
      message: message || error.message,
      ...extraContext,
    },
    level: 'error',
  });
}

export function setUserContext(user) {
  if (!sentryInitialized || !user) return;

  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.displayName || `${user.firstName} ${user.lastName}`,
    role: user.role,
  });
}

export function clearUserContext() {
  if (!sentryInitialized) return;
  Sentry.setUser(null);
}

export function addBreadcrumb(message, category, data = {}) {
  if (!sentryInitialized) return;

  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data,
  });
}

export { Sentry };
