const SENTRY_FILTERS = {
  ignore: {
    errorMessages: [
      /write EPIPE/i,
      /read ECONNRESET/i,
      /ENOTFOUND/i,
      /Client network socket disconnected/i,
      /Redis connection.*lost/i,
      /Connection terminated unexpectedly/i,
      /socket hang up/i,
      /ETIMEDOUT/i,
      /ECONNREFUSED.*redis/i,
    ],
    
    errorTypes: [
      'AbortError',
    ],
    
    stackTraces: [
      /Redis\.js.*sendCommand/i,
      /stream_base_commons.*onWriteComplete/i,
    ],
    
    breadcrumbPatterns: [
      /Redis reconnecting/i,
      /Database client.*pool/i,
    ],
  },

  downgradeToWarning: {
    errorMessages: [
      /Cache.*failed/i,
      /Failed to invalidate cache/i,
      /Retry.*attempt/i,
    ],
    
    breadcrumbPatterns: [
      /Retrying operation/i,
      /Fallback to/i,
    ],
  },

  requireUserImpact: {
    errorMessages: [
      /Database query failed/i,
      /API request failed/i,
      /Webhook processing failed/i,
    ],
    
    breadcrumbPatterns: [
      /Error returned to client/i,
      /Request failed with status/i,
    ],
  },
};

function shouldIgnoreError(event, hint) {
  const error = hint?.originalException;
  const errorMessage = error?.message || event.message || '';
  const stackTrace = error?.stack || event.exception?.values?.[0]?.stacktrace || '';
  
  if (SENTRY_FILTERS.ignore.errorMessages.some(pattern => pattern.test(errorMessage))) {
    return true;
  }
  
  if (error?.name && SENTRY_FILTERS.ignore.errorTypes.includes(error.name)) {
    return true;
  }
  
  if (SENTRY_FILTERS.ignore.stackTraces.some(pattern => pattern.test(stackTrace))) {
    return true;
  }
  
  const breadcrumbs = event.breadcrumbs || [];
  const recentBreadcrumbs = breadcrumbs.slice(-10);
  
  const hasReconnectPattern = recentBreadcrumbs.some(bc => 
    SENTRY_FILTERS.ignore.breadcrumbPatterns.some(pattern => 
      pattern.test(bc.message || '')
    )
  );
  
  if (hasReconnectPattern && /EPIPE|ECONNRESET|Redis/i.test(errorMessage)) {
    return true;
  }
  
  return false;
}

function shouldDowngradeToWarning(event, hint) {
  const error = hint?.originalException;
  const errorMessage = error?.message || event.message || '';
  
  const isCriticalError = SENTRY_FILTERS.requireUserImpact.errorMessages.some(
    pattern => pattern.test(errorMessage)
  );
  
  if (isCriticalError) {
    return false;
  }
  
  if (SENTRY_FILTERS.downgradeToWarning.errorMessages.some(pattern => pattern.test(errorMessage))) {
    return true;
  }
  
  const breadcrumbs = event.breadcrumbs || [];
  const recentBreadcrumbs = breadcrumbs.slice(-10);
  
  const hasDowngradePattern = recentBreadcrumbs.some(bc => 
    SENTRY_FILTERS.downgradeToWarning.breadcrumbPatterns.some(pattern => 
      pattern.test(bc.message || '')
    )
  );
  
  if (hasDowngradePattern) {
    return true;
  }
  
  return false;
}

function assessUserImpact(event, hint) {
  const error = hint?.originalException;
  const errorMessage = error?.message || event.message || '';
  const breadcrumbs = event.breadcrumbs || [];
  const recentBreadcrumbs = breadcrumbs.slice(-10);
  
  const hasRetryBreadcrumb = recentBreadcrumbs.some(bc => 
    /retry|retrying|attempt \d+/i.test(bc.message || '')
  );
  
  const hasSuccessBreadcrumb = recentBreadcrumbs.some(bc => 
    /success|completed|✅/i.test(bc.message || '')
  );
  
  if (hasRetryBreadcrumb && hasSuccessBreadcrumb) {
    return 'recovered';
  }
  
  const hasCriticalPattern = SENTRY_FILTERS.requireUserImpact.errorMessages.some(
    pattern => pattern.test(errorMessage)
  );
  
  const hasUserImpactBreadcrumb = recentBreadcrumbs.some(bc => 
    SENTRY_FILTERS.requireUserImpact.breadcrumbPatterns.some(pattern => 
      pattern.test(bc.message || '')
    )
  );
  
  if (hasCriticalPattern) {
    if (hasUserImpactBreadcrumb) {
      return 'critical';
    }
    return 'critical';
  }
  
  return 'unknown';
}

function enrichErrorContext(event, hint) {
  const error = hint?.originalException;
  const errorMessage = error?.message || event.message || '';
  const breadcrumbs = event.breadcrumbs || [];
  const recentBreadcrumbs = breadcrumbs.slice(-10);
  
  if (!event.tags) event.tags = {};
  if (!event.contexts) event.contexts = {};
  
  const hasRetry = recentBreadcrumbs.some(bc => /retry|retrying|attempt \d+/i.test(bc.message || ''));
  const hasRecovery = recentBreadcrumbs.some(bc => /reconnect|recovered|success/i.test(bc.message || ''));
  const isInfrastructure = /redis|database|connection|socket|network/i.test(errorMessage);
  const isBusinessLogic = /webhook|order|product|user|payment/i.test(errorMessage);
  
  event.tags.has_retry = hasRetry;
  event.tags.has_recovery = hasRecovery;
  event.tags.is_infrastructure = isInfrastructure;
  event.tags.is_business_logic = isBusinessLogic;
  
  const userImpact = assessUserImpact(event, hint);
  event.tags.user_impact = userImpact;
  
  const shouldAlert = userImpact === 'critical' || userImpact === 'recovered';
  
  event.contexts.error_classification = {
    has_retry: hasRetry,
    has_recovery: hasRecovery,
    is_infrastructure: isInfrastructure,
    is_business_logic: isBusinessLogic,
    user_impact: userImpact,
    should_alert: shouldAlert,
  };
  
  return event;
}

function filterError(event, hint) {
  if (shouldIgnoreError(event, hint)) {
    console.log(`🔇 Sentry: Filtered out benign error: ${event.message || event.exception?.values?.[0]?.value}`);
    return null;
  }
  
  event = enrichErrorContext(event, hint);
  
  if (shouldDowngradeToWarning(event, hint)) {
    event.level = 'warning';
    console.log(`⚠️  Sentry: Downgraded error to warning: ${event.message || event.exception?.values?.[0]?.value}`);
  }
  
  const userImpact = event.contexts?.error_classification?.user_impact;
  if (userImpact === 'recovered' && event.level === 'error') {
    event.level = 'info';
    console.log(`ℹ️  Sentry: Downgraded recovered error to info: ${event.message || event.exception?.values?.[0]?.value}`);
  }
  
  return event;
}

module.exports = {
  SENTRY_FILTERS,
  shouldIgnoreError,
  shouldDowngradeToWarning,
  assessUserImpact,
  enrichErrorContext,
  filterError,
};
