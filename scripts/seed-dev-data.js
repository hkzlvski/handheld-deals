/**
 * HANDHELD DEALS - SEED DEVELOPMENT DATA
 * 
 * Generates fake games, deals, and related data for frontend development.
 * 
 * Features:
 * - 30 fake games with realistic metadata
 * - Variety of deck_status, protondb_tier, controller_support
 * - Device performance data with battery estimates
 * - 20-30 fake deals with different stores and discounts
 * - Context tags (best_for, avoid_if)
 * - Genres and release years
 * 
 * Usage: node scripts/seed-dev-data.js
 * 
 * WARNING: This will DELETE existing data! Only use in development.
 */

require('dotenv').config();
const { faker } = require('@faker-js/faker');
const { createDirectus, rest, createItems, deleteItems, readItems, authentication } = require('@directus/sdk');

// ============================================================================
// CONFIGURATION
// ============================================================================

const DIRECTUS_URL = process.env.DIRECTUS_API_URL || 'http://localhost:8055';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const NUM_GAMES = 30;
const NUM_DEALS_PER_GAME = 0.7; // 70% of games will have deals

// ============================================================================
// DIRECTUS CLIENT
// ============================================================================

const directus = createDirectus(DIRECTUS_URL)
  .with(authentication('json'))
  .with(rest());

// ============================================================================
// DATA GENERATORS
// ============================================================================

/**
 * Generate random game title
 */
function generateGameTitle() {
  const templates = [
    () => `${faker.word.adjective()} ${faker.word.noun()}`,
    () => `${faker.word.noun()} ${faker.word.verb()}`,
    () => `The ${faker.word.adjective()} ${faker.word.noun()}`,
    () => `${faker.word.noun()} ${faker.number.int({ min: 2, max: 5 })}`,
    () => `${faker.company.name()} ${faker.word.noun()}`,
    () => `${faker.word.adjective()} ${faker.word.noun()} ${faker.helpers.arrayElement(['Online', 'Remastered', 'Definitive Edition', 'Deluxe'])}`,
  ];

  const template = faker.helpers.arrayElement(templates);
  return template();
}

/**
 * Generate device performance data
 */
function generateDevicePerformance(genre, releaseYear) {
  const isIndie = genre.includes('Indie');
  const isAAA = genre.includes('Action') || genre.includes('Adventure');
  const isOld = releaseYear < 2020;

  // Base battery hours
  let deckBase = 4.0;
  let allyBase = 3.5;
  let legionBase = 3.8;

  // Adjust for genre
  if (isIndie) {
    deckBase += 2.0;
    allyBase += 1.8;
    legionBase += 2.0;
  } else if (isAAA) {
    deckBase -= 1.5;
    allyBase -= 1.8;
    legionBase -= 1.5;
  }

  // Adjust for age
  if (isOld) {
    deckBase += 0.5;
    allyBase += 0.5;
    legionBase += 0.5;
  }

  // Clamp values
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  return {
    steam_deck: {
      status: 'estimated',
      battery_hours: clamp(deckBase + faker.number.float({ min: -0.5, max: 0.5 }), 1.5, 8.0),
      estimated: true,
      notes: `Estimated based on: Genre ${genre[0]}, Release year ${releaseYear}`
    },
    rog_ally: {
      status: 'estimated',
      battery_hours: clamp(allyBase + faker.number.float({ min: -0.5, max: 0.5 }), 1.5, 6.0),
      estimated: true,
      notes: `Estimated based on: Genre ${genre[0]}, Release year ${releaseYear}`
    },
    legion_go: {
      status: 'estimated',
      battery_hours: clamp(legionBase + faker.number.float({ min: -0.5, max: 0.5 }), 1.5, 7.0),
      estimated: true,
      notes: `Estimated based on: Genre ${genre[0]}, Release year ${releaseYear}`
    }
  };
}

/**
 * Generate fake game
 */
function generateGame(index) {
  const title = generateGameTitle();
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${faker.number.int({ min: 100000, max: 999999 })}`;

  const genres = faker.helpers.arrayElements(
    ['Action', 'Adventure', 'RPG', 'Strategy', 'Indie', 'Simulation', 'Puzzle', 'Racing', 'Sports'],
    faker.number.int({ min: 1, max: 3 })
  );

  const releaseYear = faker.number.int({ min: 2015, max: 2024 });

  const deckStatuses = ['verified', 'playable', 'unsupported', 'unknown'];
  const deckStatus = faker.helpers.arrayElement(deckStatuses);

  const protondbTiers = ['platinum', 'gold', 'silver', 'bronze', 'borked', 'unknown'];
  const protondbTier = faker.helpers.arrayElement(protondbTiers);

  const controllerSupport = faker.helpers.arrayElement(['full', 'partial', 'none']);

  const bestForTags = faker.helpers.arrayElements(
    ['travel', 'couch_gaming', 'quick_sessions', 'long_sessions', 'multiplayer', 'single_player', 'offline'],
    faker.number.int({ min: 0, max: 3 })
  );

  const avoidIfTags = faker.helpers.arrayElements(
    ['small_text', 'always_online', 'requires_mouse', 'heavy_graphics', 'long_load_times'],
    faker.number.int({ min: 0, max: 2 })
  );

  return {
    title,
    slug,
    steam_app_id: faker.number.int({ min: 100000, max: 999999 }),
    cover_image_url: `https://picsum.photos/seed/${slug}/460/215`,
    deck_status: deckStatus,
    protondb_tier: protondbTier,
    controller_support: controllerSupport,
    launcher: faker.helpers.arrayElement(['steam', 'epic', 'gog', 'ea', 'none']),
    always_online: faker.datatype.boolean(0.2),
    cloud_save: faker.datatype.boolean(0.7),
    genre: genres,
    release_year: releaseYear,
    metacritic_score: faker.number.int({ min: 50, max: 95 }),
    steam_positive_percent: faker.number.int({ min: 60, max: 98 }),
    steam_review_count: faker.number.int({ min: 100, max: 50000 }),
    best_for: bestForTags,
    avoid_if: avoidIfTags,
    data_reliability: 'estimated_api',
    device_performance: generateDevicePerformance(genres, releaseYear)
  };
}

/**
 * Generate fake deal for a game
 */
function generateDeal(gameId) {
  const stores = ['steam', 'gog', 'humble', 'gmg', 'fanatical'];
  const store = faker.helpers.arrayElement(stores);

  const normalPrice = faker.number.float({ min: 4.99, max: 59.99, precision: 0.01 });
  const discountPercent = faker.number.int({ min: 10, max: 90 });
  const price = normalPrice * (1 - discountPercent / 100);
  const cheapestPrice = price * faker.number.float({ min: 0.9, max: 1.0, precision: 0.01 });

  const isHistoricalLow = Math.abs(price - cheapestPrice) < 0.01;

  // Some deals expire, some don't
  const hasExpiry = faker.datatype.boolean(0.6);
  const expiresAt = hasExpiry
    ? faker.date.future({ years: 0.1 }).toISOString() // Within ~1 month
    : null;

  return {
    game_id: gameId,
    store,
    price: parseFloat(price.toFixed(2)),
    normal_price: parseFloat(normalPrice.toFixed(2)),
    discount_percent: discountPercent,
    url: `https://www.cheapshark.com/redirect?dealID=${faker.string.alphanumeric(20)}`,
    is_historical_low: isHistoricalLow,
    cheapest_price_ever: parseFloat(cheapestPrice.toFixed(2)),
    expires_at: expiresAt,
    last_checked: new Date().toISOString()
  };
}

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function seedDevData() {
  console.log('🌱 SEEDING DEVELOPMENT DATA...\n');
  console.log(`📡 Connecting to Directus: ${DIRECTUS_URL}\n`);

  console.log('⚠️  WARNING: This will DELETE existing games and deals!');
  console.log('⚠️  Only use in development environment!\n');

  // Safety check
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ ERROR: Cannot run seed script in production!');
    process.exit(1);
  }

  try {
    // Login
    console.log('🔐 Logging in to Directus...');
    await directus.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('✅ Logged in successfully!\n');

    // ========================================================================
    // STEP 1: CLEAN EXISTING DATA
    // ========================================================================

    console.log('🧹 Step 1: Cleaning existing data...\n');

    // Delete existing deals
    console.log('   Deleting deals...');
    const existingDeals = await directus.request(
      readItems('deals', {
        fields: ['id'],
        limit: -1
      })
    );

    if (existingDeals.length > 0) {
      await directus.request(
        deleteItems('deals', existingDeals.map(d => d.id))
      );
      console.log(`   ✅ Deleted ${existingDeals.length} deals`);
    } else {
      console.log(`   ✓ No existing deals to delete`);
    }

    // Delete existing games
    console.log('   Deleting games...');
    const existingGames = await directus.request(
      readItems('games', {
        fields: ['id'],
        limit: -1
      })
    );

    if (existingGames.length > 0) {
      await directus.request(
        deleteItems('games', existingGames.map(g => g.id))
      );
      console.log(`   ✅ Deleted ${existingGames.length} games\n`);
    } else {
      console.log(`   ✓ No existing games to delete\n`);
    }

    // ========================================================================
    // STEP 2: CREATE FAKE GAMES
    // ========================================================================

    console.log(`🎮 Step 2: Creating ${NUM_GAMES} fake games...\n`);

    const games = [];
    for (let i = 0; i < NUM_GAMES; i++) {
      games.push(generateGame(i));
    }

    const createdGames = await directus.request(
      createItems('games', games)
    );

    console.log(`✅ Created ${createdGames.length} games\n`);

    // ========================================================================
    // STEP 3: CREATE FAKE DEALS
    // ========================================================================

    const numGamesWithDeals = Math.floor(NUM_GAMES * NUM_DEALS_PER_GAME);
    console.log(`💰 Step 3: Creating deals for ${numGamesWithDeals} games...\n`);

    const deals = [];
    const gamesWithDeals = faker.helpers.arrayElements(createdGames, numGamesWithDeals);

    for (const game of gamesWithDeals) {
      // Each game gets 1-2 deals
      const numDeals = faker.number.int({ min: 1, max: 2 });

      for (let i = 0; i < numDeals; i++) {
        deals.push(generateDeal(game.id));
      }
    }

    const createdDeals = await directus.request(
      createItems('deals', deals)
    );

    console.log(`✅ Created ${createdDeals.length} deals\n`);

    // ========================================================================
    // SUMMARY
    // ========================================================================

    console.log('='.repeat(60));
    console.log('📊 SEED DATA SUMMARY');
    console.log('='.repeat(60));
    console.log(`🎮 Games created: ${createdGames.length}`);
    console.log(`💰 Deals created: ${createdDeals.length}`);
    console.log('');
    console.log('Game Distribution:');

    // Count by deck_status
    const deckStatusCounts = {};
    createdGames.forEach(g => {
      deckStatusCounts[g.deck_status] = (deckStatusCounts[g.deck_status] || 0) + 1;
    });
    console.log('   Deck Status:');
    Object.entries(deckStatusCounts).forEach(([status, count]) => {
      console.log(`      ${status}: ${count}`);
    });

    // Count by controller_support
    const controllerCounts = {};
    createdGames.forEach(g => {
      controllerCounts[g.controller_support] = (controllerCounts[g.controller_support] || 0) + 1;
    });
    console.log('   Controller Support:');
    Object.entries(controllerCounts).forEach(([support, count]) => {
      console.log(`      ${support}: ${count}`);
    });

    // Deal distribution by store
    const storeCounts = {};
    createdDeals.forEach(d => {
      storeCounts[d.store] = (storeCounts[d.store] || 0) + 1;
    });
    console.log('   Deals by Store:');
    Object.entries(storeCounts).forEach(([store, count]) => {
      console.log(`      ${store}: ${count}`);
    });

    console.log('='.repeat(60) + '\n');
    console.log('✅ Development data seeded successfully!');
    console.log('🌐 Visit http://localhost:8055 to view in Directus\n');

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
  seedDevData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { seedDevData };