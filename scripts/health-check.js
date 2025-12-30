/**
 * HANDHELD DEALS - HEALTH CHECK SCRIPT
 * 
 * Verifies that all cron jobs are running successfully.
 * Checks last successful run timestamp against expected intervals.
 * Alerts if job hasn't run in 2x expected interval.
 * 
 * Usage: node scripts/health-check.js
 * Schedule: Every 30 minutes
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ============================================================================
// CONFIGURATION
// ============================================================================

const logsDir = path.join(__dirname, '..', 'logs');

// Discord webhook for alerts (optional)
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL || null;

// Job configurations with expected intervals (in minutes)
const JOBS = {
  'cheapshark': {
    name: 'CheapShark Deals',
    interval: 60,           // Runs hourly
    alertThreshold: 180,    // Alert if no run in 3 hours
    critical: true
  },
  'price-alerts': {
    name: 'Price Alerts',
    interval: 60,           // Runs hourly
    alertThreshold: 180,    // Alert if no run in 3 hours
    critical: true
  },
  'events': {
    name: 'Event Status',
    interval: 60,           // Runs hourly
    alertThreshold: 180,    // Alert if no run in 3 hours
    critical: false
  },
  'protondb': {
    name: 'ProtonDB Sync',
    interval: 360,          // Runs every 6 hours
    alertThreshold: 720,    // Alert if no run in 12 hours
    critical: false
  },
  'steam': {
    name: 'Steam Sync',
    interval: 1440,         // Runs daily
    alertThreshold: 2160,   // Alert if no run in 36 hours
    critical: true
  },
  'cleanup-deals': {
    name: 'Deal Cleanup',
    interval: 1440,         // Runs daily
    alertThreshold: 2160,   // Alert if no run in 36 hours
    critical: false
  },
  'cleanup-preferences': {
    name: 'Preferences Cleanup',
    interval: 1440,         // Runs daily
    alertThreshold: 2160,   // Alert if no run in 36 hours
    critical: false
  },
  'stale-data': {
    name: 'Stale Data Downgrade',
    interval: 10080,        // Runs weekly
    alertThreshold: 20160,  // Alert if no run in 2 weeks
    critical: false
  },
  'stale-reviews': {
    name: 'Stale Reviews',
    interval: 10080,        // Runs weekly
    alertThreshold: 20160,  // Alert if no run in 2 weeks
    critical: false
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse log file to find last successful run
 */
function getLastSuccessfulRun(jobName) {
  const logFile = path.join(logsDir, `cron-${jobName}.log`);

  if (!fs.existsSync(logFile)) {
    return null;
  }

  try {
    const logContent = fs.readFileSync(logFile, 'utf8');
    const lines = logContent.split('\n').reverse(); // Read from end

    // Look for "CRON JOB COMPLETED" marker
    for (const line of lines) {
      if (line.includes('✅ CRON JOB COMPLETED')) {
        // Extract timestamp from line
        const timestampMatch = line.match(/\[([^\]]+)\]/);
        if (timestampMatch) {
          return new Date(timestampMatch[1]);
        }
      }
    }

    return null;
  } catch (error) {
    console.error(`Error reading log file for ${jobName}:`, error.message);
    return null;
  }
}

/**
 * Send Discord alert
 */
async function sendDiscordAlert(message, severity = 'warning') {
  if (!DISCORD_WEBHOOK) {
    console.log('   ℹ️  Discord webhook not configured, skipping alert');
    return;
  }

  const colors = {
    critical: 15158332,  // Red
    warning: 16776960,   // Yellow
    info: 3447003        // Blue
  };

  try {
    await axios.post(DISCORD_WEBHOOK, {
      embeds: [{
        title: '⚠️ Handheld Deals - Health Check Alert',
        description: message,
        color: colors[severity] || colors.warning,
        timestamp: new Date().toISOString()
      }]
    });
    console.log('   📧 Discord alert sent');
  } catch (error) {
    console.error('   ❌ Failed to send Discord alert:', error.message);
  }
}

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function runHealthCheck() {
  console.log('🏥 HEALTH CHECK STARTING...\n');
  console.log(`📅 Timestamp: ${new Date().toISOString()}\n`);

  const now = Date.now();
  const issues = [];
  const warnings = [];
  let allHealthy = true;

  console.log('⚙️  Checking all cron jobs...\n');

  for (const [jobKey, jobConfig] of Object.entries(JOBS)) {
    console.log(`📌 ${jobConfig.name}`);
    console.log(`   Expected interval: ${jobConfig.interval} minutes`);
    console.log(`   Alert threshold: ${jobConfig.alertThreshold} minutes`);

    const lastRun = getLastSuccessfulRun(jobKey);

    if (!lastRun) {
      console.log(`   ⚠️  No successful runs found in logs`);

      const message = `🔴 ${jobConfig.name}: No successful runs found`;
      warnings.push(message);

      if (jobConfig.critical) {
        allHealthy = false;
        issues.push(message);
      }
    } else {
      const minutesSinceLastRun = Math.floor((now - lastRun) / (1000 * 60));
      console.log(`   Last run: ${lastRun.toISOString()}`);
      console.log(`   Time since: ${minutesSinceLastRun} minutes ago`);

      if (minutesSinceLastRun > jobConfig.alertThreshold) {
        console.log(`   🚨 ALERT: Job overdue!`);

        const message = `🔴 ${jobConfig.name}: No run in ${minutesSinceLastRun} minutes (threshold: ${jobConfig.alertThreshold})`;
        warnings.push(message);

        if (jobConfig.critical) {
          allHealthy = false;
          issues.push(message);
        }
      } else {
        console.log(`   ✅ Healthy`);
      }
    }

    console.log('');
  }

  // Summary
  console.log('='.repeat(60));
  console.log('📊 HEALTH CHECK SUMMARY');
  console.log('='.repeat(60));

  if (allHealthy && warnings.length === 0) {
    console.log('✅ All jobs are healthy!');
  } else {
    if (issues.length > 0) {
      console.log(`🚨 CRITICAL ISSUES: ${issues.length}`);
      issues.forEach(issue => console.log(`   - ${issue}`));
    }

    if (warnings.length > 0 && issues.length === 0) {
      console.log(`⚠️  WARNINGS: ${warnings.length}`);
      warnings.forEach(warning => console.log(`   - ${warning}`));
    }

    // Send alerts
    if (issues.length > 0) {
      const alertMessage = `**CRITICAL ISSUES DETECTED:**\n\n${issues.join('\n')}`;
      await sendDiscordAlert(alertMessage, 'critical');
    } else if (warnings.length > 0) {
      const alertMessage = `**Warnings detected:**\n\n${warnings.join('\n')}`;
      await sendDiscordAlert(alertMessage, 'warning');
    }
  }

  console.log('='.repeat(60) + '\n');
  console.log('✅ Health check complete!');

  // Exit with error code if critical issues found
  if (issues.length > 0) {
    process.exit(1);
  }
}

// ============================================================================
// RUN SCRIPT
// ============================================================================

if (require.main === module) {
  runHealthCheck()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { runHealthCheck };