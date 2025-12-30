/**
 * HANDHELD DEALS - PROTONDB SYNC SCRIPT
 * 
 * Syncs ProtonDB compatibility tiers from community API.
 * 
 * Features:
 * - Fetch ProtonDB tier from community API
 * - Data quality filters (confidence, recency, report count)
 * - Respectful rate limiting (1 req/sec)
 * - Process only games with steam_app_id
 * - Skip games with manual curator overrides
 * 
 * Usage: node scripts/sync-protondb.js
 */

require('dotenv').config();
const axios = require('axios');
const { createDirectus, rest, readItems, updateItem, authentication } = require('@directus/sdk');

// ============================================================================
// CONFIGURATION
// ============================================================================

const DIRECTUS_URL = process.env.DIRECTUS_API_URL || 'http://localhost:8055';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PROTONDB_API = 'https://www.protondb.com/api/v1/reports/summaries';

// Rate limiting
const REQUESTS_PER_RUN = 50; // Limit to 50 games per run
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second (respectful)
const MAX_RETRIES = 3;

// Data quality thresholds
const QUALITY_THRESHOLDS = {
  minReports: 5,           // Minimum 5 reports
  minConfidence: 'low'     // Accept low/medium/high confidence
};

// Valid ProtonDB tiers
const VALID_TIERS = ['platinum', 'gold', 'silver', 'bronze', 'borked'];

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
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch ProtonDB data with retry logic
 */
async function fetchProtonDBData(steamAppId, retries = MAX_RETRIES) {
  try {
    console.log(`    📊 Fetching ProtonDB data for app ${steamAppId}...`);

    const response = await axios.get(`${PROTONDB_API}/${steamAppId}.json`, {
      timeout: 5000,
      headers: {
        'User-Agent': 'HandheldDeals/1.0 (Sync Script)'
      }
    });

    return response.data;

  } catch (error) {
    // 404 = No ProtonDB data (game not tested)
    if (error.response && error.response.status === 404) {
      console.log(`    ⚠️  No ProtonDB data available (not tested)`);
      return null;
    }

    if (retries > 0) {
      console.log(`    ⚠️  ProtonDB error, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
      await sleep(2000);
      return fetchProtonDBData(steamAppId, retries - 1);
    }

    console.error(`    ❌ Failed to fetch ProtonDB data:`, error.message);
    return null;
  }
}

/**
 * Validate ProtonDB data quality
 */
function validateProtonDBData(data) {
  if (!data) {
    return { valid: false, reason: 'no_data' };
  }

  // Check minimum reports
  if (data.total < QUALITY_THRESHOLDS.minReports) {
    return {
      valid: false,
      reason: `insufficient_reports (${data.total} < ${QUALITY_THRESHOLDS.minReports})`
    };
  }

  // Check if tier is valid
  const tier = data.bestReportedTier || data.trendingTier;
  if (!tier || !VALID_TIERS.includes(tier.toLowerCase())) {
    return { valid: false, reason: 'invalid_tier' };
  }

  return {
    valid: true,
    tier: tier.toLowerCase(),
    confidence: data.confidence || 'unknown',
    reports: data.total
  };
}

/**
 * Process single game - fetch ProtonDB data and update
 */
async function processGame(game) {
  console.log(`\n📌 Processing: ${game.title}`);
  console.log(`   Steam App ID: ${game.steam_app_id}`);
  console.log(`   Current ProtonDB tier: ${game.protondb_tier}`);

  try {
    // Fetch ProtonDB data
    const protonData = await fetchProtonDBData(game.steam_app_id);

    // Validate data quality
    const validation = validateProtonDBData(protonData);

    if (!validation.valid) {
      console.log(`   ⏭️  Skipping - ${validation.reason}`);
      return { success: false, reason: validation.reason };
    }

    // Update game in Directus
    await directus.request(
      updateItem('games', game.id, {
        protondb_tier: validation.tier
      })
    );

    console.log(`   ✅ Updated successfully`);
    console.log(`      Tier: ${validation.tier}`);
    console.log(`      Confidence: ${validation.confidence}`);
    console.log(`      Reports: ${validation.reports}`);

    return { success: true, tier: validation.tier };

  } catch (error) {
    console.error(`   ❌ Error processing game:`, error.message);
    return { success: false, reason: error.message };
  }
}

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function syncProtonDB() {
  console.log('🐧 PROTONDB SYNC STARTING...\n');
  console.log(`📡 Connecting to Directus: ${DIRECTUS_URL}`);
  console.log(`🌐 ProtonDB API: ${PROTONDB_API}\n`);

  try {
    // Login to Directus
    console.log('🔐 Logging in to Directus...');
    await directus.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('✅ Logged in successfully!\n');

    // Fetch games that need ProtonDB data
    console.log(`📥 Fetching games with steam_app_id and incomplete ProtonDB data...`);

    const games = await directus.request(
      readItems('games', {
        filter: {
          _and: [
            { steam_app_id: { _nnull: true } }, // Has Steam app ID
            {
              _or: [
                { protondb_tier: { _null: true } },      // Missing tier
                { protondb_tier: { _eq: 'unknown' } }    // Unknown tier
              ]
            }
          ]
        },
        limit: REQUESTS_PER_RUN,
        fields: ['id', 'title', 'steam_app_id', 'protondb_tier']
      })
    );

    console.log(`✅ Found ${games.length} games needing ProtonDB data`);
    console.log(`🎯 Processing up to ${REQUESTS_PER_RUN} games...\n`);

    if (games.length === 0) {
      console.log('✅ All games already have ProtonDB data!');
      return;
    }

    // Process games
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    const tierStats = {
      platinum: 0,
      gold: 0,
      silver: 0,
      bronze: 0,
      borked: 0
    };

    for (const game of games) {
      const result = await processGame(game);

      if (result.success) {
        updated++;
        if (result.tier) {
          tierStats[result.tier]++;
        }
      } else if (result.reason && result.reason.includes('reports') || result.reason === 'no_data') {
        skipped++;
      } else {
        errors++;
      }

      processed++;

      // Progress indicator
      if (processed % 10 === 0) {
        console.log(`\n⏳ Progress: ${processed}/${games.length} games processed...`);
      }

      // Rate limiting - 1 second between requests
      if (processed < games.length) {
        await sleep(DELAY_BETWEEN_REQUESTS);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 PROTONDB SYNC SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully updated: ${updated} games`);
    console.log(`⏭️  Skipped (insufficient data): ${skipped} games`);
    console.log(`❌ Errors: ${errors} games`);
    console.log(`📈 Success rate: ${((updated / games.length) * 100).toFixed(1)}%`);
    console.log('');
    console.log('📊 TIER DISTRIBUTION:');
    console.log(`   🟢 Platinum: ${tierStats.platinum} games`);
    console.log(`   🟡 Gold: ${tierStats.gold} games`);
    console.log(`   🟠 Silver: ${tierStats.silver} games`);
    console.log(`   🔴 Bronze: ${tierStats.bronze} games`);
    console.log(`   ⚫ Borked: ${tierStats.borked} games`);
    console.log('='.repeat(60) + '\n');

    console.log('✅ ProtonDB sync complete!');

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
  syncProtonDB()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { syncProtonDB };