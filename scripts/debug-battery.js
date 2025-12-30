require('dotenv').config();
const { createDirectus, rest, readItems, updateItem, staticToken } = require('@directus/sdk');

const DIRECTUS_URL = process.env.DIRECTUS_API_URL || 'http://localhost:8055';
const ADMIN_TOKEN = process.env.DIRECTUS_ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.error('❌ DIRECTUS_ADMIN_TOKEN not set in .env!');
  process.exit(1);
}

const directus = createDirectus(DIRECTUS_URL)
  .with(staticToken(ADMIN_TOKEN))
  .with(rest());

const DEVICE_BASE_HOURS = {
  steam_deck: 4.0,
  rog_ally: 3.5,
  legion_go: 3.8
};

function estimateBatteryForDevice(game, device) {
  console.log(`\n  Estimating for ${device}...`);
  console.log(`    - game.genre:`, game.genre);
  console.log(`    - game.release_year:`, game.release_year);

  let hours = DEVICE_BASE_HOURS[device];
  console.log(`    - Base hours:`, hours);

  // Try release year modifier
  if (game.release_year) {
    if (game.release_year < 2020) {
      hours += 0.5;
      console.log(`    - Added pre-2020 modifier: +0.5h`);
    } else if (game.release_year >= 2023) {
      hours -= 0.5;
      console.log(`    - Added 2023+ modifier: -0.5h`);
    }
  }

  console.log(`    - Final hours:`, hours);

  return {
    status: 'untested',
    fps_avg: null,
    battery_hours: hours,
    tested_settings: null,
    tested_date: null,
    notes: 'Test estimate',
    estimated: true
  };
}

function estimateAllDevices(game) {
  console.log(`\nEstimating for game: ${game.title}`);

  const devicePerformance = {};
  const devices = ['steam_deck', 'rog_ally', 'legion_go'];

  for (const device of devices) {
    devicePerformance[device] = estimateBatteryForDevice(game, device);
  }

  console.log(`\nFinal device_performance object:`, JSON.stringify(devicePerformance, null, 2));

  return devicePerformance;
}

async function testOne() {
  console.log('🔍 Testing battery estimation on ONE game\n');

  try {
    const games = await directus.request(
      readItems('games', {
        fields: ['id', 'title', 'genre', 'release_year', 'deck_status', 'protondb_tier', 'device_performance'],
        limit: 1
      })
    );

    const game = games[0];
    console.log('Selected game:', game.title);

    // Try estimation
    const devicePerformance = estimateAllDevices(game);

    console.log('\n✅ Estimation successful!');
    console.log('\nNow trying to UPDATE in Directus...');

    // Try update
    await directus.request(
      updateItem('games', game.id, {
        device_performance: devicePerformance
      })
    );

    console.log('✅ Update successful!');

  } catch (error) {
    console.error('\n❌ ERROR CAUGHT:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('Full error:', JSON.stringify(error, null, 2));
  }
}

testOne();