/**
 * Feature Flags (ESM wrapper)
 * Single source of truth: featureFlags.json
 */

import featureFlags from './featureFlags.json' assert { type: 'json' };

export const FEATURE_FLAGS = featureFlags;
