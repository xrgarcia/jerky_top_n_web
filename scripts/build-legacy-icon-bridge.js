#!/usr/bin/env node

/**
 * Build script for legacy icon bridge.
 * Bundles the icon utilities into an IIFE for use in vanilla JavaScript.
 */

const esbuild = require('esbuild');
const path = require('path');

esbuild.build({
  entryPoints: [path.join(__dirname, '../src/utils/legacyIconBridge.js')],
  bundle: true,
  outfile: path.join(__dirname, '../legacy/js/vendor/icon-utils.legacy.js'),
  format: 'iife',
  target: 'es2015',
  minify: false,
  define: {
    'import.meta.env.VITE_API_ORIGIN': 'undefined'
  }
}).then(() => {
  console.log('✓ Legacy icon bridge built successfully');
}).catch((error) => {
  console.error('✗ Failed to build legacy icon bridge:', error);
  process.exit(1);
});
