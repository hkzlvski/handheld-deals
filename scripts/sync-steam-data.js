/**
 * HANDHELD DEALS - STEAM DATA SYNC SCRIPT
 * 
 * Syncs game metadata from Steam Store API to database.
 * 
 * Features:
 * - Fetch metadata: genres, release year, Metacritic score
 * - Controller support detection
 * - Review data (positive %, total count) - NEW v3.0
 * - Initialize device_performance with estimates - NEW v3.0
 * - Rate limiting (1 request/second - respectful)
 * - Retry logic for failed requests
 * - Process only games with incomplete data
 * 
 * Usage: node scripts/sync-steam-data.js
 */

require('dotenv').config();
const axios = require('axios');
const { createDirectus, rest, readItems, updateItem, authentication } = require('@directus/sdk');

// Import battery estimation from existing script
const { estimateAllDevices } = require('./estimate-battery');

// ============================================================================
// CONFIGURATION
// ============================================================================

const DIRECTUS_URL = process.env.DIRECTUS_API_URL || 'http://localhost:8055';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const STEAM_STORE_API = process.env.STEAM_STORE_API || 'https://store.steampowered.com/api';
const STEAMSPY_API = 'https://steamspy.com/api.php';

// Rate limiting
const REQUESTS_PER_RUN = 50; // Limit to 50 games per run
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second (respectful)
const MAX_RETRIES = 3;

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
 * Fetch Steam app details with retry logic
 */
async function fetchSteamAppDetails(steamAppId, retries = MAX_RETRIES) {
  try {
    console.log(`    📡 Fetching Steam data for app ${steamAppId}...`);

    const response = await axios.get(`${STEAM_STORE_API}/appdetails`, {
      params: {
        appids: steamAppId
      },
      timeout: 5000 // 5 second timeout
    });

    const data = response.data[steamAppId];

    if (!data || !data.success) {
      console.log(`    ⚠️  Steam API returned no data for app ${steamAppId}`);
      return null;
    }

    return data.data;

  } catch (error) {
    if (retries > 0) {
      console.log(`    ⚠️  Error fetching Steam data, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
      await sleep(2000); // Wait 2 seconds before retry
      return fetchSteamAppDetails(steamAppId, retries - 1);
    }

    console.error(`    ❌ Failed to fetch Steam data after ${MAX_RETRIES} retries:`, error.message);
    return null;
  }
}

/**
 * Fetch SteamSpy data for controller support fallback
 */
async function fetchSteamSpyData(steamAppId, retries = MAX_RETRIES) {
  try {
    console.log(`    📊 Fetching SteamSpy data for app ${steamAppId}...`);

    const response = await axios.get(STEAMSPY_API, {
      params: {
        request: 'appdetails',
        appid: steamAppId
      },
      timeout: 5000
    });

    return response.data;

  } catch (error) {
    if (retries > 0) {
      console.log(`    ⚠️  SteamSpy error, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
      await sleep(2000);
      return fetchSteamSpyData(steamAppId, retries - 1);
    }

    console.error(`    ❌ Failed to fetch SteamSpy data:`, error.message);
    return null;
  }
}

/**
 * Parse controller support from Steam data or SteamSpy
 */
async function parseControllerSupport(steamData, steamAppId) {
  // First try Steam Store API
  if (steamData.controller_support) {
    let support = '';

    if (typeof steamData.controller_support === 'string') {
      support = steamData.controller_support.toLowerCase();
    } else if (typeof steamData.controller_support === 'object') {
      support = JSON.stringify(steamData.controller_support).toLowerCase();
    }

    if (support.includes('full')) {
      console.log(`    🎮 Controller: full (from Steam API)`);
      return 'full';
    }

    if (support.includes('partial')) {
      console.log(`    🎮 Controller: partial (from Steam API)`);
      return 'partial';
    }

    if (support.includes('controller')) {
      console.log(`    🎮 Controller: partial (from Steam API)`);
      return 'partial';
    }
  }

  // Fallback to SteamSpy
  console.log(`    ⚠️  Steam API has no controller info, trying SteamSpy...`);

  const spyData = await fetchSteamSpyData(steamAppId);

  if (!spyData || !spyData.category) {
    console.log(`    ❌ No SteamSpy data available`);
    return 'none';
  }

  const category = spyData.category.toLowerCase();

  if (category.includes('full controller support')) {
    console.log(`    🎮 Controller: full (from SteamSpy)`);
    return 'full';
  }

  if (category.includes('partial controller support')) {
    console.log(`    🎮 Controller: partial (from SteamSpy)`);
    return 'partial';
  }

  console.log(`    🎮 Controller: none (not found in SteamSpy)`);
  return 'none';
}

/**
 * Parse genres from Steam data
 */
function parseGenres(steamData) {
  if (!steamData.genres || !Array.isArray(steamData.genres)) {
    return null;
  }

  return steamData.genres.map(g => g.description);
}

/**
 * Extract review data from Steam (NEW v3.0)
 */
function extractReviewData(steamData) {
  const reviewData = {
    positive_percent: null,
    total_reviews: null
  };

  // Total review count
  if (steamData.recommendations && steamData.recommendations.total) {
    reviewData.total_reviews = steamData.recommendations.total;
  }

  // Positive percentage - Steam doesn't provide directly
  // We can estimate from review score description if available
  // For now, leave as null (can be enhanced later)

  return reviewData;
}

/**
 * Process single game - fetch Steam data and update
 */
async function processGame(game) {
  console.log(`\n📌 Processing: ${game.title}`);
  console.log(`   Steam App ID: ${game.steam_app_id}`);

  try {
    // Fetch Steam data
    const steamData = await fetchSteamAppDetails(game.steam_app_id);

    if (!steamData) {
      console.log(`   ⏭️  Skipping - no Steam data available`);
      return { success: false, reason: 'no_data' };
    }

    // Extract data
    const controllerSupport = await parseControllerSupport(steamData, game.steam_app_id);
    const genres = parseGenres(steamData);
    const releaseYear = steamData.release_date && steamData.release_date.date
      ? new Date(steamData.release_date.date).getFullYear()
      : null;
    const metacriticScore = steamData.metacritic && steamData.metacritic.score
      ? steamData.metacritic.score
      : null;
    const reviewData = extractReviewData(steamData);

    // Initialize device_performance if empty (NEW v3.0)
    let devicePerformance = game.device_performance;

    if (!devicePerformance || Object.keys(devicePerformance).length === 0) {
      console.log(`   🔋 Initializing device_performance with estimates...`);

      // Use battery estimation algorithm
      const gameWithData = {
        ...game,
        genre: genres,
        release_year: releaseYear
      };

      devicePerformance = estimateAllDevices(gameWithData);
    }

    // Prepare update data
    const updateData = {
      controller_support: controllerSupport,
      release_year: releaseYear
    };

    // Only update if we have data
    if (genres && genres.length > 0) {
      updateData.genre = genres;
    }

    if (metacriticScore) {
      updateData.metacritic_score = metacriticScore;
    }

    if (reviewData.total_reviews) {
      updateData.steam_review_count = reviewData.total_reviews;
    }

    if (devicePerformance) {
      updateData.device_performance = devicePerformance;
    }

    // Update game in Directus
    await directus.request(
      updateItem('games', game.id, updateData)
    );

    console.log(`   ✅ Updated successfully`);
    console.log(`      Controller: ${controllerSupport}`);
    console.log(`      Genres: ${genres ? genres.join(', ') : 'N/A'}`);
    console.log(`      Release Year: ${releaseYear || 'N/A'}`);
    console.log(`      Metacritic: ${metacriticScore || 'N/A'}`);
    console.log(`      Reviews: ${reviewData.total_reviews || 'N/A'}`);
    console.log(`      Device Performance: ${devicePerformance ? 'Initialized' : 'Already set'}`);

    return { success: true };

  } catch (error) {
    console.error(`   ❌ Error processing game:`, error.message);
    return { success: false, reason: error.message };
  }
}

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function syncSteamData() {
  console.log('🎮 STEAM DATA SYNC STARTING...\n');
  console.log(`📡 Connecting to Directus: ${DIRECTUS_URL}`);
  console.log(`🌐 Steam Store API: ${STEAM_STORE_API}\n`);

  try {
    // Login to Directus
    console.log('🔐 Logging in to Directus...');
    await directus.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('✅ Logged in successfully!\n');

    // Fetch games that need Steam data
    console.log(`📥 Fetching games with steam_app_id and incomplete data...`);

    const games = await directus.request(
      readItems('games', {
        filter: {
          _and: [
            { steam_app_id: { _nnull: true } }, // Has Steam app ID
            {
              _or: [
                { genre: { _null: true } },                    // Missing genre
                { controller_support: { _null: true } },       // Missing controller support
                { controller_support: { _eq: 'none' } },       // ← DODANE: Re-check games with 'none'
                { release_year: { _null: true } }             // Missing release year
              ]
            }
          ]
        },
        limit: REQUESTS_PER_RUN,
        fields: ['id', 'title', 'steam_app_id', 'genre', 'controller_support', 'release_year', 'device_performance', 'deck_status', 'protondb_tier']
      })
    );

    console.log(`✅ Found ${games.length} games needing Steam data`);
    console.log(`🎯 Processing up to ${REQUESTS_PER_RUN} games...\n`);

    if (games.length === 0) {
      console.log('✅ All games already have Steam data!');
      return;
    }

    // Process games
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const game of games) {
      const result = await processGame(game);

      if (result.success) {
        updated++;
      } else if (result.reason === 'no_data') {
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
        await sleep(2000); // Increased for SteamSpy rate limits
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 STEAM SYNC SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully updated: ${updated} games`);
    console.log(`⏭️  Skipped (no data): ${skipped} games`);
    console.log(`❌ Errors: ${errors} games`);
    console.log(`📈 Success rate: ${((updated / games.length) * 100).toFixed(1)}%`);
    console.log('='.repeat(60) + '\n');

    console.log('✅ Steam data sync complete!');

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
  syncSteamData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { syncSteamData };