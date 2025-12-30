/**
 * Healthcheck ping utility
 * Sends success ping to healthchecks.io
 */

const https = require('https');

/**
 * Ping healthchecks.io on successful job completion
 * @param {string} url - Healthcheck URL from environment
 */
function pingHealthcheck(url) {
  if (!url) {
    return; // Skip if not configured
  }

  https.get(url).on('error', (err) => {
    // Silently fail - don't break the script if healthchecks.io is down
    console.log(`   ⚠️  Healthcheck ping failed (non-critical): ${err.message}`);
  });
}

module.exports = { pingHealthcheck };