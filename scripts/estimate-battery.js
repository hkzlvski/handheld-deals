require('dotenv').config();
const axios = require('axios');
const { Logger } = require('./utils/logger');

const logger = new Logger('estimate-battery');

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

function estimateBatteryDrain(game) {
  // Base assumption: 4 hours average on Steam Deck
  let baseHours = 4.0;
  
  // Handle both 'genre' (JSON) and 'genres' (string) for compatibility
  let genres = '';
  if (typeof game.genre === 'string') {
    genres = game.genre.toLowerCase();
  } else if (game.genre) {
    genres = JSON.stringify(game.genre).toLowerCase();
  } else if (game.genres) {
    genres = game.genres.toLowerCase();
  }
  
  const releaseYear = game.release_year || 2020;
  const deckStatus = game.deck_status || 'unknown';
  const controllerSupport = game.controller_support || 'unknown';
  
  // Genre modifiers
  if (genres.includes('indie') || genres.includes('2d') || genres.includes('puzzle')) {
    baseHours += 2;
  }
  
  if (genres.includes('turn-based') || genres.includes('roguelike') || genres.includes('card')) {
    baseHours += 1;
  }
  
  if (genres.includes('aaa') || genres.includes('fps') || genres.includes('action') || 
      genres.includes('shooter') || genres.includes('racing')) {
    baseHours -= 1.5;
  }
  
  if (genres.includes('strategy') && !genres.includes('turn-based')) {
    baseHours -= 0.5;
  }
  
  // Release year modifier
  if (releaseYear >= 2023) {
    baseHours -= 0.5;
  } else if (releaseYear >= 2020) {
    baseHours -= 0.25;
  } else if (releaseYear <= 2015) {
    baseHours += 0.5;
  }
  
  // Deck optimization modifier
  if (deckStatus === 'verified') {
    baseHours += 0.5;
  } else if (deckStatus === 'playable') {
    baseHours += 0.25;
  }
  
  // Controller support modifier
  if (controllerSupport === 'full') {
    baseHours += 0;
  } else if (controllerSupport === 'partial') {
    baseHours -= 0.5;
  } else if (controllerSupport === 'none') {
    baseHours -= 0.75;
  }
  
  // Clamp between 1.5h - 8h
  const finalHours = Math.max(1.5, Math.min(8, baseHours));
  
  // Categorize
  let category;
  if (finalHours >= 5) {
    category = 'low';
  } else if (finalHours >= 3) {
    category = 'medium';
  } else {
    category = 'high';
  }
  
  return {
    category,
    estimatedHours: Math.round(finalHours * 10) / 10
  };
}

async function updateGameBattery(game) {
  try {
    const battery = estimateBatteryDrain(game);
    
    // Only update if currently 'medium' (default) or empty
    if (game.battery_drain !== 'medium' && game.battery_drain) {
      logger.info(`Skipping ${game.title} - already has custom battery value`);
      logger.incrementStat('skipped');
      return;
    }
    
    await directusRequest('PATCH', `/items/games/${game.id}`, {
      battery_drain: battery.category
    });
    
    logger.success(`${game.title}: ${battery.category} (~${battery.estimatedHours}h)`);
    logger.incrementStat('updated');
    
  } catch (error) {
    console.error('FULL ERROR for', game.title, ':', error.response?.data || error.message || error);
    logger.error(`Failed to update battery for "${game.title}"`, error.response?.data?.errors?.[0]?.message || error.message);
    logger.incrementStat('errors');
  }
}

async function estimateAll() {
  logger.info('🔋 Starting battery life estimation...');
  
  try {
    await getDirectusToken();
    
    // Fetch all games
    logger.info('Fetching games from Directus...');
    const gamesResult = await directusRequest('GET', '/items/games?limit=-1');
    
    const games = gamesResult.data;
    logger.info(`Found ${games.length} games\n`);
    
    if (games.length === 0) {
      logger.warn('No games to process');
      return;
    }
    
    // Count by category for summary
    const categoryCounts = { low: 0, medium: 0, high: 0 };
    
    // Process each game
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      logger.incrementStat('processed');
      
      const battery = estimateBatteryDrain(game);
      categoryCounts[battery.category]++;
      
      logger.info(`[${i + 1}/${games.length}] ${game.title}: ${battery.category} (~${battery.estimatedHours}h)`);
      
      await updateGameBattery(game);
      
      // Rate limit delay
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    logger.info('\n✅ Battery estimation completed!');
    logger.info('\n📊 Distribution:');
    logger.info(`Low drain (5-8h):      ${categoryCounts.low} games`);
    logger.info(`Medium drain (3-5h):   ${categoryCounts.medium} games`);
    logger.info(`High drain (1.5-3h):   ${categoryCounts.high} games`);
    
    logger.printSummary();
    
  } catch (error) {
    logger.error('Fatal error during battery estimation', error);
    process.exit(1);
  }
}

// Run the script
estimateAll();
