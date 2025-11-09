/**
 * Legacy bridge to expose icon utilities to vanilla JavaScript.
 * This file is bundled as an IIFE and loaded globally in legacy/index.html.
 */

import { renderIconString, getAssetUrl } from './iconUtilsCore.js';

// Expose utilities on window for legacy JavaScript
window.LegacyIconUtils = {
  renderIconString,
  getAssetUrl
};
