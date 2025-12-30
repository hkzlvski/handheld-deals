/**
 * HANDHELD DEALS - BATTERY LIFE ESTIMATION SCRIPT
 * 
 * Estimates battery life for games across three handheld devices:
 * - Steam Deck (40Whr battery, 4.0h baseline)
 * - ROG Ally (smaller battery, 3.5h baseline)
 * - Legion Go (larger battery, 3.8h baseline)
 * 
 * Algorithm uses device-specific modifiers based on:
 * - Genre (indie/AAA/action/puzzle)
 * - Release year (older = less demanding)
 * - Optimization (Deck Verified, ProtonDB tier)
 * - Device-specific TDP characteristics
 * 
 * Usage: node scripts/estimate-battery.js
 */

require('dotenv').config();
const { createDirectus, rest, readItems, updateItem, staticToken } = require('@directus/sdk');

// ============================================================================
// CONFIGURATION
// ============================================================================

const DIRECTUS_URL = process.env.DIRECTUS_API_URL || process.env.PUBLIC_URL || 'http://localhost:8055';
const ADMIN_TOKEN = process.env.DIRECTUS_ADMIN_TOKEN;

// Validate token
if (!ADMIN_TOKEN) {
  console.error('❌ Error: DIRECTUS_ADMIN_TOKEN not found in .env file!');
  console.error('Please add your admin token to .env:');
  console.error('DIRECTUS_ADMIN_TOKEN=your_token_here');
  process.exit(1);
}

// Device-specific base battery hours
const DEVICE_BASE_HOURS = {
  steam_deck: 4.0,  // 40Whr battery, balanced performance
  rog_ally: 3.5,    // Smaller battery, higher TDP
  legion_go: 3.8    // Larger battery than Ally
};

// Device-specific clamp ranges (min, max)
const DEVICE_CLAMPS = {
  steam_deck: { min: 1.5, max: 8.0 },
  rog_ally: { min: 1.5, max: 6.0 },   // Shorter due to smaller battery
  legion_go: { min: 1.5, max: 7.0 }
};

// Genre modifiers (apply to all devices)
const GENRE_MODIFIERS = {
  // Positive modifiers (less demanding)
  indie: 2.0,
  '2d': 2.0,
  puzzle: 1.5,
  'turn-based': 1.0,
  roguelike: 1.0,
  strategy: 0.8,

  // Negative modifiers (more demanding)
  aaa: -1.5,
  action: -1.0,
  fps: -1.0,
  racing: -0.8,
  rpg: -0.5,
  simulation: -0.3
};

// Device-specific additional modifiers
const DEVICE_SPECIFIC_MODIFIERS = {
  rog_ally: {
    action: -0.5,  // Higher TDP under load
    fps: -0.5
  },
  legion_go: {
    // Larger battery advantage
    all: 0.3
  }
};

// Release year modifiers
const RELEASE_YEAR_MODIFIER = {
  pre2020: 0.5,   // Older, less demanding
  recent: -0.5    // 2023+, more demanding
};

// Optimization modifiers
const OPTIMIZATION_MODIFIERS = {
  deck_verified: 0.5,      // Valve optimized (Steam Deck only)
  protondb_platinum: 0.3   // Community-proven efficient
};

// ============================================================================
// DIRECTUS CLIENT
// ============================================================================

const directus = createDirectus(DIRECTUS_URL)
  .with(staticToken(ADMIN_TOKEN))
  .with(rest());

// ============================================================================
// BATTERY ESTIMATION ALGORITHM
// ============================================================================

/**
 * Estimate battery life for a specific device
 * @param {Object} game - Game object from Directus
 * @param {string} device - Device identifier (steam_deck, rog_ally, legion_go)
 * @returns {Object} - { hours, category, estimated: true }
 */
function estimateBatteryForDevice(game, device) {
  // Start with device base hours
  let hours = DEVICE_BASE_HOURS[device];

  // Track applied modifiers for notes
  const appliedModifiers = [];

  // -------------------------
  // 1. GENRE MODIFIERS
  // -------------------------
  if (game.genre && Array.isArray(game.genre) && game.genre.length > 0) {
    const genres = game.genre.map(g => String(g).toLowerCase());

    for (const [genreKey, modifier] of Object.entries(GENRE_MODIFIERS)) {
      if (genres.some(g => g.includes(genreKey))) {
        hours += modifier;
        appliedModifiers.push(`Genre ${genreKey}: ${modifier > 0 ? '+' : ''}${modifier}h`);
        break; // Apply only first matching genre modifier
      }
    }
  } else {
    // No genre data - use baseline only
    appliedModifiers.push(`No genre data - baseline only`);
  }

  // -------------------------
  // 2. DEVICE-SPECIFIC MODIFIERS
  // -------------------------
  if (device === 'rog_ally' && game.genre && Array.isArray(game.genre) && game.genre.length > 0) {
    const genres = game.genre.map(g => String(g).toLowerCase());
    const deviceMods = DEVICE_SPECIFIC_MODIFIERS.rog_ally;

    for (const [genreKey, modifier] of Object.entries(deviceMods)) {
      if (genres.some(g => g.includes(genreKey))) {
        hours += modifier;
        appliedModifiers.push(`ROG Ally ${genreKey}: ${modifier}h`);
      }
    }
  }

  if (device === 'legion_go') {
    hours += DEVICE_SPECIFIC_MODIFIERS.legion_go.all;
    appliedModifiers.push(`Legion Go battery: +0.3h`);
  }

  // -------------------------
  // 3. RELEASE YEAR MODIFIER
  // -------------------------
  if (game.release_year) {
    if (game.release_year < 2020) {
      hours += RELEASE_YEAR_MODIFIER.pre2020;
      appliedModifiers.push(`Pre-2020: +0.5h`);
    } else if (game.release_year >= 2023) {
      hours += RELEASE_YEAR_MODIFIER.recent;
      appliedModifiers.push(`2023+ release: -0.5h`);
    }
  }

  // -------------------------
  // 4. OPTIMIZATION MODIFIERS
  // -------------------------
  // Deck Verified (Steam Deck only)
  if (device === 'steam_deck' && game.deck_status === 'verified') {
    hours += OPTIMIZATION_MODIFIERS.deck_verified;
    appliedModifiers.push(`Deck Verified: +0.5h`);
  }

  // ProtonDB Platinum (all devices)
  if (game.protondb_tier === 'platinum') {
    hours += OPTIMIZATION_MODIFIERS.protondb_platinum;
    appliedModifiers.push(`ProtonDB Platinum: +0.3h`);
  }

  // -------------------------
  // 5. CLAMP TO DEVICE RANGE
  // -------------------------
  const clamp = DEVICE_CLAMPS[device];
  hours = Math.max(clamp.min, Math.min(clamp.max, hours));

  // -------------------------
  // 6. CATEGORIZE
  // -------------------------
  let category;
  if (device === 'steam_deck') {
    if (hours >= 5) category = 'low';
    else if (hours >= 3) category = 'medium';
    else category = 'high';
  } else if (device === 'rog_ally') {
    if (hours >= 4) category = 'low';
    else if (hours >= 2.5) category = 'medium';
    else category = 'high';
  } else { // legion_go
    if (hours >= 4.5) category = 'low';
    else if (hours >= 3) category = 'medium';
    else category = 'high';
  }

  // Round to 1 decimal place
  hours = Math.round(hours * 10) / 10;

  return {
    hours,
    category,
    estimated: true,
    notes: `Estimated based on: ${appliedModifiers.join(', ') || 'baseline only'}`
  };
}

/**
 * Estimate battery for all three devices
 * @param {Object} game - Game object from Directus
 * @returns {Object} - device_performance object with all devices
 */
function estimateAllDevices(game) {
  const devices = ['steam_deck', 'rog_ally', 'legion_go'];
  const devicePerformance = {};

  for (const device of devices) {
    const estimate = estimateBatteryForDevice(game, device);

    devicePerformance[device] = {
      status: 'untested',
      fps_avg: null,
      battery_hours: estimate.hours,
      tested_settings: null,
      tested_date: null,
      notes: estimate.notes,
      estimated: true
    };
  }

  return devicePerformance;
}

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function runBatteryEstimation() {
  console.log('🔋 BATTERY ESTIMATION SCRIPT STARTING...\n');
  console.log(`📡 Connecting to Directus: ${DIRECTUS_URL}\n`);

  try {
    // Fetch all games
    console.log('📥 Fetching games from database...');
    const games = await directus.request(
      readItems('games', {
        fields: ['id', 'title', 'genre', 'release_year', 'deck_status', 'protondb_tier', 'device_performance'],
        limit: -1 // Get all games
      })
    );

    console.log(`✅ Found ${games.length} games\n`);

    // Filter games that need estimation
    // (device_performance is null, empty, or missing battery_hours for any device)
    const gamesToProcess = games.filter(game => {
      if (!game.device_performance) return true;

      const dp = game.device_performance;
      const devices = ['steam_deck', 'rog_ally', 'legion_go'];

      for (const device of devices) {
        if (!dp[device] || dp[device].battery_hours === null || dp[device].battery_hours === undefined) {
          return true;
        }
      }

      return false;
    });

    console.log(`🎯 ${gamesToProcess.length} games need battery estimation`);
    console.log(`⏭️  ${games.length - gamesToProcess.length} games already have estimates\n`);

    if (gamesToProcess.length === 0) {
      console.log('✅ All games already have battery estimates!');
      return;
    }

    // Process games
    let processed = 0;
    let errors = 0;

    console.log('⚙️  Processing games...\n');

    for (const game of gamesToProcess) {
      try {
        // Estimate for all devices
        const devicePerformance = estimateAllDevices(game);

        // Update game in Directus
        await directus.request(
          updateItem('games', game.id, {
            device_performance: devicePerformance
          })
        );

        processed++;

        // Log progress every 10 games
        if (processed % 10 === 0) {
          console.log(`  ✓ Processed ${processed}/${gamesToProcess.length} games...`);
        }

      } catch (error) {
        errors++;
        console.error(`  ❌ Error processing "${game.title}":`, error.message);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 BATTERY ESTIMATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully processed: ${processed} games`);
    console.log(`❌ Errors: ${errors} games`);
    console.log(`📈 Success rate: ${((processed / gamesToProcess.length) * 100).toFixed(1)}%`);
    console.log('='.repeat(60) + '\n');

    // Sample results
    if (processed > 0) {
      console.log('🔍 SAMPLE RESULTS (first 5 games):');
      const samples = gamesToProcess.slice(0, 5);

      for (const game of samples) {
        const dp = estimateAllDevices(game);
        console.log(`\n📌 ${game.title}`);
        console.log(`   Steam Deck: ~${dp.steam_deck.battery_hours}h`);
        console.log(`   ROG Ally:   ~${dp.rog_ally.battery_hours}h`);
        console.log(`   Legion Go:  ~${dp.legion_go.battery_hours}h`);
      }
    }

    console.log('\n✅ Battery estimation complete!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// ============================================================================
// RUN SCRIPT
// ============================================================================

if (require.main === module) {
  runBatteryEstimation()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}

// Export for testing
module.exports = {
  estimateBatteryForDevice,
  estimateAllDevices
};