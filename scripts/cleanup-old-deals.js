require('dotenv').config();
const axios = require('axios');
const { Logger } = require('./utils/logger');

const logger = new Logger('cleanup-old-deals');

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

async function cleanupOldDeals() {
  logger.info('🧹 Cleaning up old deals...');
  
  try {
    await getDirectusToken();
    
    // Calculate cutoff date (7 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const cutoffISO = cutoffDate.toISOString();
    
    logger.info(`Removing deals not checked since: ${cutoffISO}`);
    
    // Find old deals
    const filter = {
      last_checked: {
        _lt: cutoffISO
      }
    };
    
    const dealsResult = await directusRequest(
      'GET',
      `/items/deals?filter=${JSON.stringify(filter)}&limit=-1`
    );
    
    const oldDeals = dealsResult.data || [];
    
    logger.info(`Found ${oldDeals.length} deals to remove`);
    
    if (oldDeals.length === 0) {
      logger.info('No old deals to cleanup');
      logger.printSummary();
      return;
    }
    
    // Delete each deal
    for (const deal of oldDeals) {
      logger.incrementStat('processed');
      
      try {
        await directusRequest('DELETE', `/items/deals/${deal.id}`);
        logger.success(`Removed old deal: ${deal.id}`);
        logger.incrementStat('created'); // Using 'created' as 'deleted' counter
      } catch (error) {
        logger.error(`Failed to delete deal ${deal.id}`, error);
        logger.incrementStat('errors');
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    logger.info('\n✅ Cleanup completed!');
    logger.printSummary();
    
  } catch (error) {
    logger.error('Fatal error during cleanup', error);
    process.exit(1);
  }
}

// Run the script
cleanupOldDeals().then(() => {
  // Ping healthchecks.io on success
  const https = require('https');
  https.get('https://hc-ping.com/6b953cc4-69aa-49d6-a95b-f8f0df74176e').on('error', () => {});
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
