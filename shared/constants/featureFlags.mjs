/**
 * Feature Flags (ESM wrapper)
 * Single source of truth: featureFlags.js
 */

const flags = require('./featureFlags.js');

export const FEATURE_FLAGS = flags.FEATURE_FLAGS;
