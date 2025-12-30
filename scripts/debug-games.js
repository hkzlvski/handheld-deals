/**
 * DEBUG SCRIPT - Check game data structure
 * 
 * This script fetches a few sample games to see how data is actually structured
 * in the database, especially the 'genre' field format.
 * 
 * Usage: node scripts/debug-games.js
 */

require('dotenv').config();
const { createDirectus, rest, readItems } = require('@directus/sdk');

const DIRECTUS_URL = process.env.DIRECTUS_API_URL || process.env.PUBLIC_URL || 'http://localhost:8055';
const directus = createDirectus(DIRECTUS_URL).with(rest());

async function debugGames() {
  console.log('🔍 DEBUGGING GAME STRUCTURE\n');
  console.log(`📡 Connecting to: ${DIRECTUS_URL}\n`);

  try {
    // Fetch 3 sample games
    const games = await directus.request(
      readItems('games', {
        fields: ['id', 'title', 'genre', 'release_year', 'deck_status', 'protondb_tier', 'device_performance'],
        limit: 3
      })
    );

    console.log(`✅ Fetched ${games.length} sample games\n`);
    console.log('='.repeat(60));

    games.forEach((game, i) => {
      console.log(`\n📌 GAME ${i + 1}: ${game.title}`);
      console.log('-'.repeat(60));
      console.log('genre:');
      console.log('  Value:', JSON.stringify(game.genre, null, 2));
      console.log('  Type:', typeof game.genre);
      console.log('  Is Array:', Array.isArray(game.genre));
      console.log('');
      console.log('release_year:', game.release_year, `(${typeof game.release_year})`);
      console.log('deck_status:', game.deck_status, `(${typeof game.deck_status})`);
      console.log('protondb_tier:', game.protondb_tier, `(${typeof game.protondb_tier})`);
      console.log('');
      console.log('device_performance:');
      console.log('  Value:', JSON.stringify(game.device_performance, null, 2));
      console.log('  Type:', typeof game.device_performance);
    });

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Debug complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

debugGames()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });