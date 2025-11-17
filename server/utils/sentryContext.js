const Sentry = require('@sentry/node');

function addRetryContext(attemptNumber, maxAttempts, operation) {
  Sentry.addBreadcrumb({
    category: 'retry',
    message: `Retry attempt ${attemptNumber}/${maxAttempts} for ${operation}`,
    level: 'info',
    data: {
      attempt: attemptNumber,
      max_attempts: maxAttempts,
      operation,
    },
  });
}

function addRecoveryContext(operation, success = true, details = {}) {
  Sentry.addBreadcrumb({
    category: 'recovery',
    message: success ? `✅ ${operation} recovered successfully` : `❌ ${operation} recovery failed`,
    level: success ? 'info' : 'warning',
    data: {
      operation,
      success,
      ...details,
    },
  });
}

function addUserImpactContext(impactLevel, description, details = {}) {
  Sentry.addBreadcrumb({
    category: 'user_impact',
    message: `${impactLevel.toUpperCase()}: ${description}`,
    level: impactLevel === 'critical' ? 'error' : impactLevel === 'moderate' ? 'warning' : 'info',
    data: {
      impact_level: impactLevel,
      description,
      ...details,
    },
  });
}

function captureErrorWithContext(error, {
  operation,
  hasRetry = false,
  hasRecovery = false,
  userImpact = 'unknown',
  userAffected = false,
  additionalContext = {},
} = {}) {
  let level = 'error';
  if (userImpact === 'recovered') {
    level = 'info';
  } else if (userImpact === 'critical') {
    level = 'error';
  }
  
  Sentry.captureException(error, {
    tags: {
      operation: operation || 'unknown',
      has_retry: hasRetry,
      has_recovery: hasRecovery,
      user_impact: userImpact,
      user_affected: userAffected,
    },
    extra: {
      ...additionalContext,
    },
    level: level,
  });
}

function setInfrastructureContext(service, healthy = true, details = {}) {
  Sentry.setContext('infrastructure', {
    service,
    healthy,
    timestamp: new Date().toISOString(),
    ...details,
  });
}

module.exports = {
  addRetryContext,
  addRecoveryContext,
  addUserImpactContext,
  captureErrorWithContext,
  setInfrastructureContext,
};
