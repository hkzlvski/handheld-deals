/**
 * HANDHELD DEALS - CRON SCHEDULER
 * 
 * Central cron job scheduler using node-cron.
 * Manages all automated tasks for the application.
 * 
 * Usage:
 * - Development: node scripts/cron-scheduler.js
 * - Production: pm2 start scripts/cron-scheduler.js --name handheld-deals-cron
 * 
 * All jobs log to /logs/ directory with rotation
 */

require('dotenv').config();
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { pingHealthcheck } = require('./utils/healthcheck-ping');

// Import all cron scripts
const { fetchCheapSharkDeals } = require('./fetch-cheapshark');
const { syncSteamData } = require('./sync-steam-data');
const { syncProtonDB } = require('./sync-protondb');
const { cleanupOldDeals } = require('./cleanup-old-deals');
const { updateEventStatus } = require('./update-event-status');
const { processPriceAlerts } = require('./process-price-alerts');
const { cleanupPreferences } = require('./cleanup-preferences');
const { flagStaleReviews } = require('./flag-stale-reviews');
const { downgradeStaleData } = require('./downgrade-stale-data');

// ============================================================================
// LOGGING SETUP
// ============================================================================

const logsDir = path.join(__dirname, '..', 'logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log(`📁 Created logs directory: ${logsDir}`);
}

/**
 * Log wrapper for cron jobs
 */
function logJob(jobName, logFn, healthcheckUrl = null) {
  return async () => {
    const logFile = path.join(logsDir, `cron-${jobName}.log`);
    const timestamp = new Date().toISOString();

    // Create write stream for logging
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });

    // Redirect console to log file
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args) => {
      const message = args.join(' ');
      logStream.write(`[${timestamp}] ${message}\n`);
      originalLog(...args);
    };

    console.error = (...args) => {
      const message = args.join(' ');
      logStream.write(`[${timestamp}] ERROR: ${message}\n`);
      originalError(...args);
    };

    try {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🚀 CRON JOB STARTED: ${jobName}`);
      console.log(`📅 ${timestamp}`);
      console.log('='.repeat(80) + '\n');

      await logFn();

      console.log(`\n✅ CRON JOB COMPLETED: ${jobName}\n`);

      // Ping healthchecks.io on success
      if (healthcheckUrl) {
        pingHealthcheck(healthcheckUrl);
      }

    } catch (error) {
      console.error(`❌ CRON JOB FAILED: ${jobName}`);
      console.error(`Error: ${error.message}`);
      console.error(`Stack: ${error.stack}`);
    } finally {
      // Restore console
      console.log = originalLog;
      console.error = originalError;
      logStream.end();
    }
  };
}

// ============================================================================
// CRON JOBS CONFIGURATION
// ============================================================================

console.log('⏰ HANDHELD DEALS - CRON SCHEDULER STARTING...\n');
console.log('📅 Scheduling all cron jobs...\n');

// HOURLY JOBS
// ============================================================================

// Price updates - Every hour at :00
cron.schedule('0 * * * *', logJob('cheapshark', fetchCheapSharkDeals, process.env.HEALTHCHECK_CHEAPSHARK), {
  scheduled: true,
  timezone: "Europe/Warsaw"
});

// Price alerts - Every hour at :15
cron.schedule('15 * * * *', logJob('price-alerts', processPriceAlerts, process.env.HEALTHCHECK_PRICE_ALERTS), {
  scheduled: true,
  timezone: "Europe/Warsaw"
});

// Event status - Every hour at :30
cron.schedule('30 * * * *', logJob('events', updateEventStatus, process.env.HEALTHCHECK_EVENTS), {
  scheduled: true,
  timezone: "Europe/Warsaw"
});

// EVERY 6 HOURS
// ============================================================================

// ProtonDB sync - Every 6 hours at :00
cron.schedule('0 */6 * * *', logJob('protondb', syncProtonDB, process.env.HEALTHCHECK_PROTONDB), {
  scheduled: true,
  timezone: "Europe/Warsaw"
});

// DAILY JOBS
// ============================================================================

// Steam sync - Daily at 2 AM
cron.schedule('0 2 * * *', logJob('steam', syncSteamData, process.env.HEALTHCHECK_STEAM), {
  scheduled: true,
  timezone: "Europe/Warsaw"
});

// Deal cleanup - Daily at 4 AM
cron.schedule('0 4 * * *', logJob('cleanup-deals', cleanupOldDeals, process.env.HEALTHCHECK_CLEANUP_DEALS), {
  scheduled: true,
  timezone: "Europe/Warsaw"
});

// Preferences cleanup - Daily at 5 AM
cron.schedule('0 5 * * *', logJob('cleanup-preferences', cleanupPreferences, process.env.HEALTHCHECK_CLEANUP_PREFS), {
  scheduled: true,
  timezone: "Europe/Warsaw"
});

// WEEKLY JOBS
// ============================================================================

// Stale data downgrade - Monday at 3 AM
cron.schedule('0 3 * * 1', logJob('stale-data', downgradeStaleData, process.env.HEALTHCHECK_STALE_DATA), {
  scheduled: true,
  timezone: "Europe/Warsaw"
});

// Stale reviews - Monday at 4 AM
cron.schedule('0 4 * * 1', logJob('stale-reviews', flagStaleReviews, process.env.HEALTHCHECK_STALE_REVIEWS), {
  scheduled: true,
  timezone: "Europe/Warsaw"
});

// ============================================================================
// STATUS & KEEP ALIVE
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('✅ ALL CRON JOBS SCHEDULED SUCCESSFULLY');
console.log('='.repeat(80));
console.log('\n📊 SCHEDULE SUMMARY:\n');
console.log('   HOURLY:');
console.log('   • :00 - CheapShark deals');
console.log('   • :15 - Price alerts');
console.log('   • :30 - Event status');
console.log('');
console.log('   EVERY 6 HOURS:');
console.log('   • :00 - ProtonDB sync');
console.log('');
console.log('   DAILY:');
console.log('   • 2 AM - Steam metadata sync');
console.log('   • 4 AM - Deal cleanup');
console.log('   • 5 AM - Preferences cleanup');
console.log('');
console.log('   WEEKLY (Monday):');
console.log('   • 3 AM - Stale data downgrade');
console.log('   • 4 AM - Stale reviews flagging');
console.log('\n' + '='.repeat(80));
console.log('\n⏰ Scheduler is running... Press Ctrl+C to stop\n');
console.log(`📁 Logs directory: ${logsDir}\n`);

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Shutting down cron scheduler...');
  console.log('✅ All jobs stopped');
  process.exit(0);
});

// Heartbeat every 5 minutes
setInterval(() => {
  const now = new Date().toISOString();
  console.log(`💓 Heartbeat - ${now} - Scheduler running...`);
}, 5 * 60 * 1000);