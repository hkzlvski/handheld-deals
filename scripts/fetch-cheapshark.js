require('dotenv').config();
const axios = require('axios');
const { Logger } = require('./utils/logger');
const { slugify } = require('./utils/slugify');
const { RateLimiter } = require('./utils/rate-limiter');

const logger = new Logger('fetch-cheapshark');
const rateLimiter = new RateLimiter(1000);

const SUPPORTED_STORES = {
  '1': 'steam',
  '7': 'gog',
  '25': 'epic',
  '11': 'humble',
  '3': 'gmg',
  '15': 'fanatical'
};

let directusToken = null;

async function getDirectusToken() {
  if (directusToken) return directusToken;

  try {
    const response = await axios.post(`${process.env.DIRECTUS_API_URL}/auth/login`, {
      email: process.env.DIRECTUS_ADMIN_EMAIL,
      password: process.env.DIRECTUS_ADMIN_PASSWORD
    });

    directusToken = response.data.data.access_token;
    logger.success('Connected to Directus');
    return directusToken;
  } catch (error) {
    logger.error('Failed to authenticate with Directus', error);
    throw error;
  }
}

async function directusRequest(method, endpoint, data = null) {
  const token = await getDirectusToken();
  const config = {
    method,
    url: `${process.env.DIRECTUS_API_URL}${endpoint}`,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  if (data) {
    config.data = data;
  }

  const response = await axios(config);
  return response.data;
}

async function fetchCheapSharkDeals(pageSize = 100) {
  try {
    const url = `${process.env.CHEAPSHARK_BASE_URL}/deals`;
    const response = await axios.get(url, {
      params: { sortBy: 'Savings', desc: 1, pageSize }
    });

    logger.info(`Fetched ${response.data.length} deals from CheapShark`);
        return response.data;
  } catch (error) {
    logger.error('Failed to fetch CheapShark deals', error);
    return [];
  }
}

async function fetchSteamReviews(steamAppId) {
  try {
    const url = `${process.env.STEAM_STORE_API}/appreviews/${steamAppId}`;
    const response = await axios.get(url, {
      params: { json: 1, purchase_type: 'all', language: 'all' },
      timeout: 5000
    });

    if (response.data?.query_summary) {
      const summary = response.data.query_summary;
      return {
        positive_percent: summary.review_score || null,
        total_reviews: summary.total_reviews || 0
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function checkGameQuality(steamAppId, manualOverride, gameData = null) {
  // Manual override check
  if (manualOverride === true) {
    logger.info(`✅ Quality: PASS (manual override)`);
    return { pass: true, reviews: null };
  }
  
  if (manualOverride === false) {
    logger.warn(`❌ Quality: FAIL (manual exclude)`);
    return { pass: false };
  }
  
  // Controller support check (if we have game data)
  if (gameData?.controller_support === 'none') {
    logger.warn(`❌ Quality: FAIL (no controller support)`);
    return { pass: false };
  }
  
  // Multiplayer-only check (if we have genre data)
  if (gameData?.genres) {
    const genres = gameData.genres.toLowerCase();
    
    // Check if game is multiplayer-only
    const hasMultiplayer = genres.includes('multiplayer') || genres.includes('co-op');
    const hasSinglePlayer = genres.includes('single') || genres.includes('singleplayer') || 
                           genres.includes('rpg') || genres.includes('adventure') || 
                           genres.includes('strategy') || genres.includes('simulation') ||
                           genres.includes('indie') || genres.includes('action') ||
                           genres.includes('platformer') || genres.includes('puzzle');
    
    // If ONLY multiplayer and NO single-player genres, likely multiplayer-only
    if (hasMultiplayer && !hasSinglePlayer) {
      logger.warn(`❌ Quality: FAIL (likely multiplayer-only: ${gameData.genres})`);
      return { pass: false };
    }
  }
  
  // Fetch Steam reviews
  const reviews = await fetchSteamReviews(steamAppId);
  
  if (!reviews) {
    // If no reviews but has controller support, allow it
    if (gameData?.controller_support && gameData.controller_support !== 'none') {
      logger.info(`⚠️  Quality: SKIP (no reviews but has controller support)`);
      return { pass: true, reviews: null };
    }
    logger.info(`⚠️  Quality: SKIP (no review data - allowing)`);
    return { pass: true, reviews: null };
  }
  
  // Review score check
  if (reviews.positive_percent < 60) {
    logger.warn(`❌ Quality: FAIL (${reviews.positive_percent}% rating)`);
    return { pass: false };
  }
  
  // Review count check
  if (reviews.total_reviews < 50) {
    logger.warn(`❌ Quality: FAIL (${reviews.total_reviews} reviews)`);
    return { pass: false };
  }
  
  logger.success(`✅ Quality: PASS (${reviews.positive_percent}%, ${reviews.total_reviews} reviews)`);
  return { pass: true, reviews };
}

async function findOrCreateGame(deal) {
  try {
    const steamAppId = String(deal.steamAppID);

    if (!steamAppId || steamAppId === 'undefined') {
          return null;
    }

    // Check if exists
    const slug = slugify(deal.title);
    const filter = {
      _or: [
        { steam_app_id: { _eq: steamAppId } },
        { slug: { _eq: slug } }
      ]
    };
    const queryResult = await directusRequest(
      'GET',
      `/items/games?filter=${JSON.stringify(filter)}&limit=1`
    );

    if (queryResult.data && queryResult.data.length > 0) {
      const game = queryResult.data[0];

      // Quality check
      const qualityCheck = await checkGameQuality(steamAppId, game.manual_quality_override, game);
      if (!qualityCheck.pass) {
        logger.incrementStat('skipped');
        return null;
      }

      // Update reviews if available
      if (qualityCheck.reviews) {
        await directusRequest(
          'PATCH',
          `/items/games/${game.id}`,
          {
            steam_positive_percent: qualityCheck.reviews.positive_percent,
            steam_total_reviews: qualityCheck.reviews.total_reviews
          }
        );
      }

      return game;
    }

    // Create new game
    logger.info(`Creating: ${deal.title}`);

      // For new games, we don't have controller data yet, so pass null
    const qualityCheck = await checkGameQuality(steamAppId, null, null);
    if (!qualityCheck.pass) {
      logger.incrementStat('skipped');
      return null;
    }

    const gameData = {
      title: deal.title,
      slug: slug,
      steam_app_id: steamAppId,
      steam_positive_percent: qualityCheck.reviews?.positive_percent || null,
      steam_total_reviews: qualityCheck.reviews?.total_reviews || null,
      deck_status: 'unknown',
      protondb_tier: 'unknown',
      battery_drain: 'medium',
      popularity_score: 0,
      controller_support: 'unknown'
    };

    const createResult = await directusRequest('POST', '/items/games', gameData);

    logger.success(`Created: ${deal.title}`);
    return createResult.data;

  } catch (error) {
    console.error('ACTUAL ERROR:', error.response?.data || error);
    logger.error(`Game error: ${deal.title}`, error.response?.data?.errors?.[0]?.message || error.message);
        logger.incrementStat('errors');
    return null;
  }
}

async function createOrUpdateDeal(game, deal, storeName) {
  try {
    const normalPrice = parseFloat(deal.normalPrice);
    const salePrice = parseFloat(deal.salePrice);
    const savings = parseFloat(deal.savings);

    // Check existing
    const filter = {
      _and: [
        { game_id: { _eq: game.id } },
        { store: { _eq: storeName } },
        { expires_at: { _null: true } }
      ]
    };

    const queryResult = await directusRequest(
      'GET',
      `/items/deals?filter=${JSON.stringify(filter)}&limit=1`
    );

    const dealData = {
      game_id: game.id,
      store: storeName,
      price: salePrice,
      normal_price: normalPrice,
      discount_percent: Math.round(savings),
      url: `https://www.cheapshark.com/redirect?dealID=${deal.dealID}`,
      is_historical_low: salePrice <= parseFloat(deal.cheapestPriceEver || salePrice),
      cheapest_price_ever: parseFloat(deal.cheapestPriceEver || salePrice),
      deal_rating: parseFloat(deal.dealRating) || null,
      last_checked: new Date().toISOString()
    };

    if (queryResult.data && queryResult.data.length > 0) {
      const existingDeal = queryResult.data[0];
      await directusRequest('PATCH', `/items/deals/${existingDeal.id}`, dealData);
      logger.info(`Updated: ${game.title} @ ${storeName} - $${salePrice}`);
      logger.incrementStat('updated');
    } else {
      await directusRequest('POST', '/items/deals', dealData);
      logger.success(`Deal: ${game.title} @ ${storeName} - $${salePrice} (-${Math.round(savings)}%)`);
      logger.incrementStat('created');

      // Update last_deal_date
      await directusRequest('PATCH', `/items/games/${game.id}`, {
        last_deal_date: new Date().toISOString().split('T')[0]
      });
    }

} catch (error) {
    console.error('DEAL ERROR:', error.response?.data || error);
    logger.error(`Deal error: ${game.title}`, error.response?.data?.errors?.[0]?.message || error.message);
    logger.incrementStat('errors');
  }
}

async function processDeal(deal) {
  logger.incrementStat('processed');

  const storeName = SUPPORTED_STORES[deal.storeID];
  if (!storeName) {
    logger.incrementStat('skipped');
    return;
  }

  // Skip deals with 0% discount (not actual deals)
  const savings = parseFloat(deal.savings);
  if (savings <= 0) {
    logger.warn(`Skipping ${deal.title} - no discount (0%)`);
    logger.incrementStat('skipped');
    return;
  }

  logger.info(`\n[${logger.stats.processed}] ${deal.title} (${storeName}, -${Math.round(savings)}%)`);

  const game = await findOrCreateGame(deal);
  if (!game) return;

  await createOrUpdateDeal(game, deal, storeName);
  await rateLimiter.throttle();
}

async function main() {
  logger.info('💰 Starting CheapShark deal fetch...');

  try {
    await getDirectusToken();
    const deals = await fetchCheapSharkDeals(100);

    if (deals.length === 0) {
      logger.warn('No deals fetched');
      return;
    }

    logger.info(`Processing ${deals.length} deals...\n`);

    for (const deal of deals) {
      await processDeal(deal);
    }

    logger.info('\n✅ Completed!');
    logger.printSummary();

  } catch (error) {
    logger.error('Fatal error', error);
    process.exit(1);
  }
}

main().then(() => {
  // Ping healthchecks.io on success
  const https = require('https');
  https.get('https://hc-ping.com/3c188a09-0cd6-4c9d-8526-23328327cc78').on('error', () => {});
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
