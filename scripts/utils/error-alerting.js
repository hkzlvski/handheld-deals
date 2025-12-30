/**
 * Error alerting utility
 * Sends alerts to Discord for critical errors
 */

const axios = require('axios');

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL || null;

/**
 * Error severity levels
 */
const SEVERITY = {
  CRITICAL: 'critical',  // Service down, database failed, all operations failed
  HIGH: 'high',          // >50% operations failed, API unavailable >1h
  MEDIUM: 'medium',      // 10-50% operations failed
  LOW: 'low'             // <10% operations failed
};

/**
 * Send error alert to Discord
 */
async function sendErrorAlert(scriptName, errorMessage, severity = SEVERITY.MEDIUM, additionalInfo = {}) {
  if (!DISCORD_WEBHOOK) {
    console.log('   ℹ️  Discord webhook not configured, skipping error alert');
    return;
  }

  const colors = {
    critical: 15158332,  // Red
    high: 16744272,      // Dark Orange
    medium: 16776960,    // Yellow
    low: 3447003         // Blue
  };

  const emojis = {
    critical: '🚨',
    high: '⚠️',
    medium: '⚡',
    low: 'ℹ️'
  };

  try {
    const embed = {
      title: `${emojis[severity]} Handheld Deals - Error Alert`,
      description: `**Script:** ${scriptName}\n**Severity:** ${severity.toUpperCase()}\n\n**Error:**\n${errorMessage}`,
      color: colors[severity] || colors.medium,
      timestamp: new Date().toISOString(),
      fields: []
    };

    // Add additional info as fields
    if (Object.keys(additionalInfo).length > 0) {
      for (const [key, value] of Object.entries(additionalInfo)) {
        embed.fields.push({
          name: key,
          value: String(value),
          inline: true
        });
      }
    }

    await axios.post(DISCORD_WEBHOOK, {
      embeds: [embed]
    });

    console.log('   📧 Error alert sent to Discord');
  } catch (error) {
    console.error('   ❌ Failed to send Discord alert:', error.message);
  }
}

/**
 * Determine severity based on success rate
 */
function determineSeverity(successRate, totalOperations = 0) {
  if (totalOperations === 0) {
    return SEVERITY.CRITICAL; // No operations completed
  }

  if (successRate === 0) {
    return SEVERITY.CRITICAL; // All failed
  } else if (successRate < 0.5) {
    return SEVERITY.HIGH; // <50% success
  } else if (successRate < 0.9) {
    return SEVERITY.MEDIUM; // 50-90% success
  } else {
    return SEVERITY.LOW; // >90% success
  }
}

/**
 * Check if error rate exceeds threshold and send alert
 */
async function checkErrorThreshold(scriptName, stats) {
  const { total, success, errors } = stats;

  if (total === 0) {
    return; // No operations, nothing to check
  }

  const successRate = success / total;
  const errorRate = errors / total;

  // Alert thresholds
  const CRITICAL_THRESHOLD = 1.0;   // 100% failed
  const HIGH_THRESHOLD = 0.5;       // >50% failed
  const MEDIUM_THRESHOLD = 0.1;     // >10% failed

  let shouldAlert = false;
  let severity = SEVERITY.LOW;

  if (errorRate >= CRITICAL_THRESHOLD) {
    shouldAlert = true;
    severity = SEVERITY.CRITICAL;
  } else if (errorRate >= HIGH_THRESHOLD) {
    shouldAlert = true;
    severity = SEVERITY.HIGH;
  } else if (errorRate >= MEDIUM_THRESHOLD) {
    shouldAlert = true;
    severity = SEVERITY.MEDIUM;
  }

  if (shouldAlert) {
    const message = `Error threshold exceeded!\n\nTotal operations: ${total}\nSuccessful: ${success}\nFailed: ${errors}\nError rate: ${(errorRate * 100).toFixed(1)}%`;

    await sendErrorAlert(scriptName, message, severity, {
      'Total': total,
      'Success': success,
      'Errors': errors,
      'Success Rate': `${(successRate * 100).toFixed(1)}%`
    });
  }
}

module.exports = {
  sendErrorAlert,
  checkErrorThreshold,
  determineSeverity,
  SEVERITY
};