require('dotenv').config();
const axios = require('axios');
const { createDirectus, rest, authentication, readItems, createItem } = require('@directus/sdk');
const { Logger } = require('./utils/logger');
const { slugify } = require('./utils/slugify');
const { RateLimiter } = require('./utils/rate-limiter');

const logger = new Logger('seed-popular-games');
const rateLimiter = new RateLimiter(1000);

// Popular Steam Deck games
const POPULAR_GAMES = [
  { title: 'Hades', steamAppId: '1145360' },
  { title: 'Stardew Valley', steamAppId: '413150' },
  { title: 'Vampire Survivors', steamAppId: '1794680' },
  { title: 'Celeste', steamAppId: '504230' },
  { title: 'Hollow Knight', steamAppId: '367520' },
  { title: 'Dead Cells', steamAppId: '588650' },
  { title: 'Slay the Spire', steamAppId: '646570' },
  { title: 'Terraria', steamAppId: '105600' },
  { title: 'The Binding of Isaac: Rebirth', steamAppId: '250900' },
  { title: 'Enter the Gungeon', steamAppId: '311690' },
  { title: 'Risk of Rain 2', steamAppId: '632360' },
  { title: 'Don\'t Starve Together', steamAppId: '322330' },
  { title: 'Undertale', steamAppId: '391540' },
  { title: 'Portal 2', steamAppId: '620' },
  { title: 'Half-Life 2', steamAppId: '220' },
  { title: 'Disco Elysium', steamAppId: '632470' },
  { title: 'The Witcher 3: Wild Hunt', steamAppId: '292030' },
  { title: 'Elden Ring', steamAppId: '1245620' },
  { title: 'Baldur\'s Gate 3', steamAppId: '1086940' },
  { title: 'Cyberpunk 2077', steamAppId: '1091500' },
  { title: 'Sonic Mania', steamAppId: '584400' },
  { title: 'Cuphead', steamAppId: '268910' },
  { title: 'Shovel Knight', steamAppId: '250760' },
  { title: 'A Short Hike', steamAppId: '1055540' },
  { title: 'Ori and the Blind Forest', steamAppId: '261570' },
  { title: 'Ori and the Will of the Wisps', steamAppId: '1057090' },
  { title: 'Spelunky 2', steamAppId: '418530' },
  { title: 'Into the Breach', steamAppId: '590380' },
  { title: 'FTL: Faster Than Light', steamAppId: '212680' },
  { title: 'Darkest Dungeon', steamAppId: '262060' },
  { title: 'Factorio', steamAppId: '427520' },
  { title: 'Rimworld', steamAppId: '294100' },
  { title: 'Deep Rock Galactic', steamAppId: '548430' },
  { title: 'Valheim', steamAppId: '892970' },
  { title: 'Subnautica', steamAppId: '264710' },
  { title: 'No Man\'s Sky', steamAppId: '275850' },
  { title: 'Loop Hero', steamAppId: '1282730' },
  { title: 'Inscryption', steamAppId: '1092790' },
  { title: 'Tunic', steamAppId: '553420' },
  { title: 'Death\'s Door', steamAppId: '894020' },
  { title: 'Cult of the Lamb', steamAppId: '1313140' },
  { title: 'Pizza Tower', steamAppId: '2231450' },
  { title: 'Dave the Diver', steamAppId: '1868140' },
  { title: 'Balatro', steamAppId: '2379780' },
  { title: 'Monster Hunter: World', steamAppId: '582010' },
  { title: 'Dark Souls III', steamAppId: '374320' },
  { title: 'Sekiro: Shadows Die Twice', steamAppId: '814380' },
  { title: 'Persona 5 Royal', steamAppId: '1687950' },
  { title: 'NieR:Automata', steamAppId: '524220' }
];

async function fetchSteamData(steamAppId) {
  try {
    const url = `${process.env.STEAM_STORE_API}/appdetails?appids=${steamAppId}`;
    const response = await axios.get(url);
    
    const data = response.data[steamAppId];
    if (!data || !data.success) {
      return null;
    }
    
    const game = data.data;
    return {
      description: game.short_description || null,
      release_year: game.release_date?.date ? new Date(game.release_date.date).getFullYear() : null,
      metacritic_score: game.metacritic?.score || null,
      genres: game.genres?.map(g => g.description).join(', ') || null,
      controller_support: game.controller_support || 'none'
    };
  } catch (error) {
    logger.error(`Failed to fetch Steam data for app ${steamAppId}`, error);
    return null;
  }
}

async function getDirectusClient() {
  const client = createDirectus(process.env.DIRECTUS_API_URL)
    .with(authentication())
    .with(rest());

  await client.login(
    process.env.DIRECTUS_ADMIN_EMAIL,
    process.env.DIRECTUS_ADMIN_PASSWORD
  );

  logger.success('Connected to Directus');
  return client;
}

async function createGame(client, gameData, steamData) {
  try {
    const gamePayload = {
      title: gameData.title,
      slug: slugify(gameData.title),
      steam_app_id: gameData.steamAppId,
      description: steamData?.description || null,
      release_year: steamData?.release_year || null,
      metacritic_score: steamData?.metacritic_score || null,
      genres: steamData?.genres || null,
      controller_support: steamData?.controller_support || 'unknown',
      deck_status: 'unknown',
      protondb_tier: 'unknown',
      battery_drain: 'medium',
      popularity_score: 0
    };
    
    // Check if exists
    const existingGames = await client.request(
      readItems('games', {
        filter: { steam_app_id: { _eq: gameData.steamAppId } },
        limit: 1
      })
    );
    
    if (existingGames && existingGames.length > 0) {
      logger.warn(`Game "${gameData.title}" already exists`);
      logger.incrementStat('skipped');
      return existingGames[0];
    }
    
    // Create game
    const result = await client.request(createItem('games', gamePayload));
    logger.success(`Created: ${gameData.title}`);
    logger.incrementStat('created');
    return result;
    
  } catch (error) {
    logger.error(`Failed to create "${gameData.title}"`, error);
    logger.incrementStat('errors');
    return null;
  }
}

async function seedGames() {
  logger.info('🌱 Starting game seeding...');
  logger.info(`📊 Games to process: ${POPULAR_GAMES.length}`);
  
  try {
    const client = await getDirectusClient();
    
    for (const gameData of POPULAR_GAMES) {
      logger.incrementStat('processed');
      logger.info(`\n[${logger.stats.processed}/${POPULAR_GAMES.length}] ${gameData.title}`);
      
      let steamData = null;
      try {
        steamData = await rateLimiter.executeWithRetry(
          () => fetchSteamData(gameData.steamAppId),
          `Steam: ${gameData.title}`
        );
      } catch (error) {
        logger.warn(`No Steam data for ${gameData.title}`);
      }
      
      await createGame(client, gameData, steamData);
    }
    
    logger.info('\n✅ Seeding completed!');
    logger.printSummary();
    
  } catch (error) {
    logger.error('Fatal error', error);
    process.exit(1);
  }
}

seedGames();
