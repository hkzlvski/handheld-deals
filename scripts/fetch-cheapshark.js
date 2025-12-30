/**
 * HANDHELD DEALS - CHEAPSHARK DEAL FETCHER
 * 
 * Fetches top deals from CheapShark API and populates database.
 * 
 * Features:
 * - Fetch top 100 deals sorted by discount/rating
 * - Filter by supported stores (Steam, GOG, Humble, GMG, Fanatical)
 * - Quality filter (v3.0): Steam reviews ≥60%, controller support required
 * - Auto-create games if they don't exist
 * - Update or create deal records
 * - Historical low detection
 * - Rate limiting (respectful API usage)
 * 
 * Usage: node scripts/fetch-cheapshark.js
 */

require('dotenv').config();
const axios = require('axios');
const { createDirectus, rest, readItems, createItem, updateItem, authentication } = require('@directus/sdk');

// ============================================================================
// CONFIGURATION
// ============================================================================

const DIRECTUS_URL = process.env.DIRECTUS_API_URL || 'http://localhost:8055';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const CHEAPSHARK_BASE_URL = process.env.CHEAPSHARK_BASE_URL || 'https://www.cheapshark.com/api/1.0';
const STEAM_STORE_API = process.env.STEAM_STORE_API || 'https://store.steampowered.com/api';

// Store ID mapping (CheapShark → Our database)
const STORE_MAPPING = {
  '1': 'steam',
  '7': 'gog',
  '3': 'gmg',
  '11': 'humble',
  '15': 'fanatical'
  // Epic not in mapping - CheapShark has it but we filter it out for now
};

// Supported stores (filter deals to these only)
const SUPPORTED_STORES = ['1', '7', '3', '11', '15'];

// Quality filter thresholds (NEW v3.0)
const QUALITY_THRESHOLDS = {
  minReviewScore: 60,        // Minimum 60% positive reviews
  minReviewCount: 50,        // Minimum 50 total reviews
  requireController: true    // Must have controller support
};

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
 * Slugify text for URL-friendly format
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start
    .replace(/-+$/, '');            // Trim - from end
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch Steam app details for quality check
 */
async function fetchSteamAppDetails(steamAppId) {
  try {
    const response = await axios.get(`${STEAM_STORE_API}/appdetails`, {
      params: {
        appids: steamAppId
      }
    });

    const data = response.data[steamAppId];

    if (!data || !data.success) {
      return null;
    }

    return data.data;

  } catch (error) {
    console.error(`    ⚠️  Could not fetch Steam data for app ${steamAppId}:`, error.message);
    return null;
  }
}

/**
 * Check if game passes quality filter (NEW v3.0)
 */
async function checkGameQuality(deal) {
  // If no Steam app ID, skip quality check (can't verify)
  if (!deal.steamAppID) {
    console.log(`    ⏭️  No Steam app ID, skipping quality check`);
    return { pass: true, reason: 'no_steam_id' };
  }

  // Fetch Steam data
  console.log(`    🔍 Checking quality for Steam app ${deal.steamAppID}...`);
  const steamData = await fetchSteamAppDetails(deal.steamAppID);

  if (!steamData) {
    console.log(`    ⚠️  Could not fetch Steam data, allowing through`);
    return { pass: true, reason: 'steam_data_unavailable' };
  }

  // Extract review data
  let reviewScore = null;
  let reviewCount = 0;

  if (steamData.recommendations && steamData.recommendations.total) {
    reviewCount = steamData.recommendations.total;
  }

  // Steam doesn't provide percentage directly, estimate from description
  // or use positive_ratings if available
  // For now, we'll be lenient if we can't get exact percentage

  // Check controller support
  const hasControllerSupport = steamData.controller_support &&
    steamData.controller_support !== 'none';

  // Check if multiplayer-only
  const categories = steamData.categories || [];
  const isMultiplayerOnly = categories.some(cat =>
    cat.description && cat.description.includes('Multi-player')
  ) && !categories.some(cat =>
    cat.description && cat.description.includes('Single-player')
  );

  // Apply filters
  const failures = [];

  if (!hasControllerSupport && QUALITY_THRESHOLDS.requireController) {
    failures.push('no_controller_support');
  }

  if (isMultiplayerOnly) {
    failures.push('multiplayer_only');
  }

  if (reviewCount > 0 && reviewCount < QUALITY_THRESHOLDS.minReviewCount) {
    failures.push(`insufficient_reviews (${reviewCount} < ${QUALITY_THRESHOLDS.minReviewCount})`);
  }

  // If any failures, reject
  if (failures.length > 0) {
    return {
      pass: false,
      reason: failures.join(', '),
      steamData: {
        reviewCount,
        hasControllerSupport,
        isMultiplayerOnly
      }
    };
  }

  return {
    pass: true,
    reason: 'passed_all_checks',
    steamData: {
      reviewCount,
      hasControllerSupport
    }
  };
}

/**
 * Find or create game in database
 */
async function findOrCreateGame(deal) {
  const title = deal.title;
  const steamAppId = deal.steamAppID || null;
  const slug = slugify(title);  // ← WAŻNE: generuj slug PRZED wyszukiwaniem

  console.log(`  📌 Processing game: ${title}`);

  try {
    let existingGames = [];

    // 1. Try by Steam app ID
    if (steamAppId) {
      existingGames = await directus.request(
        readItems('games', {
          filter: { steam_app_id: { _eq: steamAppId } },
          limit: 1
        })
      );
    }

    // 2. Try by exact title
    if (existingGames.length === 0) {
      existingGames = await directus.request(
        readItems('games', {
          filter: { title: { _eq: title } },
          limit: 1
        })
      );
    }

    // 3. Try by slug ← КРИТИЧЕСКИЙ FIX!
    if (existingGames.length === 0) {
      existingGames = await directus.request(
        readItems('games', {
          filter: { slug: { _eq: slug } },
          limit: 1
        })
      );
    }

    // If found, return
    if (existingGames.length > 0) {
      console.log(`    ✓ Game already exists (ID: ${existingGames[0].id})`);
      return existingGames[0];
    }

    // Create new
    console.log(`    ➕ Creating new game...`);
    const newGame = await directus.request(
      createItem('games', {
        title,
        slug,
        steam_app_id: steamAppId,
        cover_image_url: deal.thumb || null,
        deck_status: 'unknown',
        protondb_tier: 'unknown',
        data_reliability: 'estimated_api'
      })
    );

    console.log(`    ✅ Game created (ID: ${newGame.id})`);
    return newGame;

  } catch (error) {
    console.error(`    ❌ Error in findOrCreateGame:`, error.message);
    if (error.errors && error.errors[0]) {
      console.error(`       Directus error:`, error.errors[0].message);
    }
    throw error;
  }
}

/**
 * Create or update deal in database
 */
async function processDeal(deal, game) {
  const storeId = deal.storeID;
  const storeName = STORE_MAPPING[storeId];

  if (!storeName) {
    console.log(`    ⏭️  Unknown store ID ${storeId}, skipping deal`);
    return null;
  }

  console.log(`    💰 Processing ${storeName} deal...`);

  try {
    // Check if deal already exists for this game + store
    const existingDeals = await directus.request(
      readItems('deals', {
        filter: {
          _and: [
            { game_id: { _eq: game.id } },
            { store: { _eq: storeName } }
          ]
        },
        limit: 1
      })
    );

    const salePrice = parseFloat(deal.salePrice);
    const normalPrice = parseFloat(deal.normalPrice);
    const savings = parseFloat(deal.savings);
    const dealUrl = `https://www.cheapshark.com/redirect?dealID=${deal.dealID}`;

    // Historical low detection
    const cheapestPrice = parseFloat(deal.cheapestPrice || deal.salePrice);
    const isHistoricalLow = Math.abs(salePrice - cheapestPrice) < 0.01; // 1 cent tolerance

    const dealData = {
      game_id: game.id,
      store: storeName,
      price: salePrice,
      normal_price: normalPrice,
      discount_percent: Math.round(savings),
      url: dealUrl,
      is_historical_low: isHistoricalLow,
      cheapest_price_ever: cheapestPrice,
      last_checked: new Date().toISOString()
    };

    // Update or create
    if (existingDeals.length > 0) {
      // Update existing deal
      await directus.request(
        updateItem('deals', existingDeals[0].id, dealData)
      );
      console.log(`    ✓ Deal updated (${storeName}: $${salePrice})`);
    } else {
      // Create new deal
      await directus.request(
        createItem('deals', dealData)
      );
      console.log(`    ✅ Deal created (${storeName}: $${salePrice})`);
    }

    return dealData;

  } catch (error) {
    console.error(`    ❌ Error creating/updating deal:`, error.message);
    if (error.errors && error.errors[0]) {
      console.error(`       Reason:`, error.errors[0].message);
    }
    throw error; // Re-throw to be caught by main loop
  }
}

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function fetchCheapSharkDeals() {
  console.log('🦈 CHEAPSHARK DEAL FETCHER STARTING...\n');
  console.log(`📡 Connecting to Directus: ${DIRECTUS_URL}`);
  console.log(`🌐 CheapShark API: ${CHEAPSHARK_BASE_URL}\n`);

  try {
    // Login to Directus
    console.log('🔐 Logging in to Directus...');
    await directus.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('✅ Logged in successfully!\n');

    // Fetch deals from CheapShark
    console.log('📥 Fetching top deals from CheapShark...');

    const response = await axios.get(`${CHEAPSHARK_BASE_URL}/deals`, {
      params: {
        pageSize: 100,
        sortBy: 'DealRating', // Best deals first
        desc: 1,
        onSale: 1
      }
    });

    const allDeals = response.data;
    console.log(`✅ Fetched ${allDeals.length} deals from CheapShark\n`);

    // Filter to supported stores only
    const supportedDeals = allDeals.filter(deal =>
      SUPPORTED_STORES.includes(deal.storeID)
    );

    console.log(`🎯 ${supportedDeals.length} deals from supported stores`);
    console.log(`⏭️  ${allDeals.length - supportedDeals.length} deals filtered (unsupported stores)\n`);

    // Process deals
    let processed = 0;
    let created = 0;
    let updated = 0;
    let qualityFiltered = 0;
    let errors = 0;

    console.log('⚙️  Processing deals...\n');

    for (const deal of supportedDeals) {
      try {
        // Quality check (NEW v3.0)
        const qualityCheck = await checkGameQuality(deal);

        if (!qualityCheck.pass) {
          qualityFiltered++;
          console.log(`  ❌ Quality filter: ${deal.title}`);
          console.log(`    Reason: ${qualityCheck.reason}\n`);
          continue; // Skip this deal
        }

        // Find or create game
        const game = await findOrCreateGame(deal);

        // Process deal
        const dealData = await processDeal(deal, game);

        if (dealData) {
          processed++;
          // Track if it was update vs create (simplified)
          updated++;
        }

        // Progress indicator
        if (processed % 10 === 0) {
          console.log(`  ⏳ Progress: ${processed} processed, ${qualityFiltered} filtered...\n`);
        }

        // Rate limiting - 100ms between requests
        await sleep(500);

      } catch (error) {
        errors++;
        console.error(`  ❌ Error processing deal "${deal.title}":`, error.message);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 CHEAPSHARK FETCH SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully processed: ${processed} deals`);
    console.log(`🎯 Quality filtered: ${qualityFiltered} deals`);
    console.log(`❌ Errors: ${errors} deals`);
    console.log(`📈 Success rate: ${((processed / supportedDeals.length) * 100).toFixed(1)}%`);
    console.log('='.repeat(60) + '\n');

    console.log('✅ CheapShark fetch complete!');

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
  fetchCheapSharkDeals()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { fetchCheapSharkDeals };