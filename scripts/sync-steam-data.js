require('dotenv').config();
const axios = require('axios');
const { Logger } = require('./utils/logger');
const { RateLimiter } = require('./utils/rate-limiter');

const logger = new Logger('sync-steam-data');
const rateLimiter = new RateLimiter(1500); // 1.5 seconds between requests (Steam rate limit)

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

async function fetchSteamAppDetails(steamAppId) {
  try {
    const url = `${process.env.STEAM_STORE_API}/appdetails`;
    const response = await axios.get(url, {
      params: { appids: steamAppId },
      timeout: 10000
    });
    
    const data = response.data[steamAppId];
    
    if (!data || !data.success) {
      logger.warn(`Steam API returned no data for app ${steamAppId}`);
      return null;
    }
    
    const game = data.data;
    
    // Extract relevant data
    const steamData = {
      description: game.short_description || null,
      release_year: null,
      metacritic_score: game.metacritic?.score || null,
      genres: null,
      controller_support: 'unknown',
      categories: []
    };
    
    // Parse release date
    if (game.release_date?.date) {
      try {
        const releaseDate = new Date(game.release_date.date);
        if (!isNaN(releaseDate.getTime())) {
          steamData.release_year = releaseDate.getFullYear();
        }
      } catch (e) {
        logger.warn(`Could not parse release date for app ${steamAppId}`);
      }
    }
    
    // Parse genres
    if (game.genres && Array.isArray(game.genres)) {
      steamData.genres = game.genres.map(g => g.description).join(', ');
    }
    
    // Parse controller support
    if (game.controller_support) {
      const controllerText = game.controller_support.toLowerCase();
      if (controllerText.includes('full')) {
        steamData.controller_support = 'full';
      } else if (controllerText.includes('partial')) {
        steamData.controller_support = 'partial';
      } else {
        steamData.controller_support = 'none';
      }
    }
    
    // Parse categories (to detect multiplayer-only)
    if (game.categories && Array.isArray(game.categories)) {
      steamData.categories = game.categories.map(c => c.description);
    }
    
    return steamData;
    
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      logger.warn(`Timeout fetching Steam data for app ${steamAppId}`);
    } else {
      logger.warn(`Failed to fetch Steam data for app ${steamAppId}: ${error.message}`);
    }
    return null;
  }
}

async function updateGameWithSteamData(game, steamData) {
  try {
    const updateData = {};
    
    // Only update fields that have data and are currently empty/unknown
    if (steamData.description && !game.description) {
      updateData.description = steamData.description;
    }
    
    if (steamData.release_year && !game.release_year) {
      updateData.release_year = steamData.release_year;
    }
    
    if (steamData.metacritic_score && !game.metacritic_score) {
      updateData.metacritic_score = steamData.metacritic_score;
    }
    
    if (steamData.genres && !game.genres) {
      updateData.genres = steamData.genres;
    }
    
    if (steamData.controller_support && steamData.controller_support !== 'unknown' && 
        (!game.controller_support || game.controller_support === 'unknown')) {
      updateData.controller_support = steamData.controller_support;
    }
    
    // Skip if no updates needed
    if (Object.keys(updateData).length === 0) {
      logger.info(`No updates needed for: ${game.title}`);
      return false;
    }
    
    await directusRequest('PATCH', `/items/games/${game.id}`, updateData);
    
    const fields = Object.keys(updateData).join(', ');
    logger.success(`Updated ${game.title}: ${fields}`);
    logger.incrementStat('updated');
    
    return true;
    
  } catch (error) {
    logger.error(`Failed to update game "${game.title}"`, error.response?.data?.errors?.[0]?.message || error.message);
    logger.incrementStat('errors');
    return false;
  }
}

async function syncGames() {
  logger.info('🎮 Starting Steam data sync...');
  
  try {
    await getDirectusToken();
    
    // Fetch all games with steam_app_id
    logger.info('Fetching games from Directus...');
    const gamesResult = await directusRequest(
      'GET',
      '/items/games?filter[steam_app_id][_nnull]=true&limit=-1'
    );
    
    const games = gamesResult.data;
    logger.info(`Found ${games.length} games with Steam App IDs\n`);
    
    if (games.length === 0) {
      logger.warn('No games to sync');
      return;
    }
    
    // Process each game
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      logger.incrementStat('processed');
      
      logger.info(`\n[${i + 1}/${games.length}] ${game.title} (Steam ID: ${game.steam_app_id})`);
      
      // Fetch Steam data with rate limiting
      const steamData = await rateLimiter.executeWithRetry(
        () => fetchSteamAppDetails(game.steam_app_id),
        `Fetching Steam data for ${game.title}`
      );
      
      if (!steamData) {
        logger.incrementStat('skipped');
        continue;
      }
      
      // Update game
      await updateGameWithSteamData(game, steamData);
    }
    
    logger.info('\n✅ Steam sync completed!');
    logger.printSummary();
    
  } catch (error) {
    logger.error('Fatal error during Steam sync', error);
    process.exit(1);
  }
}

// Run the script
syncGames().then(() => {
  // Ping healthchecks.io on success
  const https = require('https');
  https.get('https://hc-ping.com/ca960b43-e3d2-4c62-9b96-0aee9fd8bbf2').on('error', () => {});
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
