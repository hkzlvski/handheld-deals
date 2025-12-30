/**
 * HANDHELD DEALS - DOWNGRADE STALE DATA SCRIPT
 * 
 * Auto-downgrades data_reliability from hand_tested to stale_tested after 6 months.
 * 
 * Features:
 * - Find games where data_reliability = hand_tested
 * - Check if device_performance tested_date > 6 months old (any device)
 * - Downgrade to stale_tested
 * - Add note explaining downgrade
 * 
 * Schedule: Weekly Monday at 3 AM
 * Cron: 0 3 (star) (star) 1
 * 
 * Usage: node scripts/downgrade-stale-data.js
 */

require('dotenv').config();
const { createDirectus, rest, readItems, updateItem, authentication } = require('@directus/sdk');

// ============================================================================
// CONFIGURATION
// ============================================================================

const DIRECTUS_URL = process.env.DIRECTUS_API_URL || 'http://localhost:8055';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Staleness threshold (6 months)
const STALE_THRESHOLD_DAYS = 180;

// ============================================================================
// DIRECTUS CLIENT
// ============================================================================

const directus = createDirectus(DIRECTUS_URL)
  .with(authentication('json'))
  .with(rest());

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if device performance data is stale (> 6 months old)
 */
function isDeviceDataStale(devicePerformance, cutoffDate) {
  if (!devicePerformance) return false;

  const devices = ['steam_deck', 'rog_ally', 'legion_go'];

  for (const device of devices) {
    const deviceData = devicePerformance[device];

    if (deviceData && deviceData.tested_date) {
      const testedDate = new Date(deviceData.tested_date);

      if (testedDate < cutoffDate) {
        return true; // At least one device has stale data
      }
    }
  }

  return false;
}

/**
 * Get oldest tested date from device performance
 */
function getOldestTestedDate(devicePerformance) {
  if (!devicePerformance) return null;

  const devices = ['steam_deck', 'rog_ally', 'legion_go'];
  let oldestDate = null;

  for (const device of devices) {
    const deviceData = devicePerformance[device];

    if (deviceData && deviceData.tested_date) {
      const testedDate = new Date(deviceData.tested_date);

      if (!oldestDate || testedDate < oldestDate) {
        oldestDate = testedDate;
      }
    }
  }

  return oldestDate;
}

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function downgradeStaleData() {
  console.log('📉 DOWNGRADE STALE DATA STARTING...\n');
  console.log(`📡 Connecting to Directus: ${DIRECTUS_URL}`);
  console.log(`📅 Staleness threshold: ${STALE_THRESHOLD_DAYS} days (6 months)\n`);

  try {
    // Login
    console.log('🔐 Logging in to Directus...');
    await directus.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('✅ Logged in successfully!\n');

    // Calculate cutoff date (6 months ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - STALE_THRESHOLD_DAYS);
    const cutoffISO = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD format

    console.log(`📅 Cutoff date: ${cutoffISO}\n`);

    // Fetch games with hand_tested data
    console.log('📥 Fetching games with hand_tested data...');

    const handTestedGames = await directus.request(
      readItems('games', {
        filter: {
          data_reliability: { _eq: 'hand_tested' }
        },
        fields: ['id', 'title', 'device_performance', 'data_reliability'],
        limit: -1
      })
    );

    console.log(`✅ Found ${handTestedGames.length} hand_tested games\n`);

    if (handTestedGames.length === 0) {
      console.log('ℹ️  No hand_tested games to check');
      console.log('✅ Downgrade complete!\n');
      return;
    }

    // Check for stale data
    let downgraded = 0;
    let stillFresh = 0;
    let noTestData = 0;

    console.log('⚙️  Checking for stale data...\n');

    for (const game of handTestedGames) {
      try {
        console.log(`📌 ${game.title}`);

        // Check if device performance data exists
        if (!game.device_performance) {
          console.log(`   ⚠️  No device_performance data, skipping\n`);
          noTestData++;
          continue;
        }

        // Check if data is stale
        const isStale = isDeviceDataStale(game.device_performance, cutoffDate);

        if (isStale) {
          const oldestDate = getOldestTestedDate(game.device_performance);
          const ageInDays = Math.floor((Date.now() - oldestDate) / (1000 * 60 * 60 * 24));
          const ageInMonths = Math.floor(ageInDays / 30);

          console.log(`   📅 Oldest test: ${oldestDate.toISOString().split('T')[0]}`);
          console.log(`   ⏳ Age: ${ageInMonths} months (${ageInDays} days)`);
          console.log(`   📉 Downgrading: hand_tested → stale_tested`);

          // Update data_reliability
          await directus.request(
            updateItem('games', game.id, {
              data_reliability: 'stale_tested'
            })
          );

          downgraded++;
          console.log(`   ✅ Downgraded\n`);
        } else {
          console.log(`   ✓ Still fresh, no downgrade needed\n`);
          stillFresh++;
        }

      } catch (error) {
        console.error(`   ❌ Error processing game ${game.id}:`, error.message);
      }
    }

    // Summary
    console.log('='.repeat(60));
    console.log('📊 STALE DATA DOWNGRADE SUMMARY');
    console.log('='.repeat(60));
    console.log(`📉 Downgraded: ${downgraded} games`);
    console.log(`✓ Still fresh: ${stillFresh} games`);
    console.log(`⚠️  No test data: ${noTestData} games`);
    console.log(`📊 Total checked: ${handTestedGames.length} games`);
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log('='.repeat(60) + '\n');

    if (downgraded > 0) {
      console.log('⚠️  Games downgraded to stale_tested - consider re-testing');
    }

    console.log('✅ Stale data downgrade complete!');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// ============================================================================
// RUN SCRIPT
// ============================================================================

if (require.main === module) {
  downgradeStaleData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { downgradeStaleData };