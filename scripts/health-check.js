require('dotenv').config();
const fs = require('fs');
const path = require('path');

const CHECKS = {
  'cron-cheapshark': { interval: 3600, name: 'CheapShark Updates' },
  'cron-events': { interval: 3600, name: 'Event Status' },
  'cron-steam': { interval: 86400, name: 'Steam Sync' },
  'cron-cleanup': { interval: 86400, name: 'Deal Cleanup' },
  'cron-battery': { interval: 604800, name: 'Battery Estimation' }
};

function checkLogAge(logFile, maxAgeSeconds) {
  const logPath = path.join(__dirname, '..', 'logs', logFile);
  
  if (!fs.existsSync(logPath)) {
    return { healthy: false, reason: 'Log file not found', age: null };
  }
  
  const stats = fs.statSync(logPath);
  const ageSeconds = (Date.now() - stats.mtime) / 1000;
  const threshold = maxAgeSeconds * 2; // Alert if 2x expected interval
  
  if (ageSeconds > threshold) {
    return {
      healthy: false,
      reason: `Last run ${Math.round(ageSeconds / 60)} minutes ago (expected every ${Math.round(maxAgeSeconds / 60)} min)`,
      age: ageSeconds
    };
  }
  
  return { healthy: true, age: ageSeconds };
}

console.log('🏥 Handheld Deals - Health Check');
console.log('================================\n');

let allHealthy = true;

for (const [logFile, config] of Object.entries(CHECKS)) {
  const check = checkLogAge(`${logFile}.log`, config.interval);
  const ageMinutes = check.age ? Math.round(check.age / 60) : 'N/A';
  
  if (check.healthy) {
    console.log(`✅ ${config.name}: Healthy (last run ${ageMinutes} min ago)`);
  } else {
    console.log(`❌ ${config.name}: UNHEALTHY - ${check.reason}`);
    allHealthy = false;
  }
}

console.log('\n================================');
if (allHealthy) {
  console.log('✅ All systems healthy!');
  process.exit(0);
} else {
  console.log('❌ Some systems need attention!');
  process.exit(1);
}
