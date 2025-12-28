require('dotenv').config();
const axios = require('axios');
const { Logger } = require('./utils/logger');

const logger = new Logger('update-event-status');

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

async function updateEventStatuses() {
  logger.info('📅 Updating event statuses...');
  
  try {
    await getDirectusToken();
    
    // Get all events
    const eventsResult = await directusRequest('GET', '/items/events?limit=-1');
    const events = eventsResult.data || [];
    
    logger.info(`Found ${events.length} events`);
    
    if (events.length === 0) {
      logger.info('No events to process');
      return;
    }
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    for (const event of events) {
      logger.incrementStat('processed');
      
      const startDate = event.start_date;
      const endDate = event.end_date;
      let newStatus = event.status;
      
      // Determine new status
      if (today < startDate) {
        newStatus = 'upcoming';
      } else if (today >= startDate && today <= endDate) {
        newStatus = 'active';
      } else if (today > endDate) {
        newStatus = 'ended';
      }
      
      // Update if changed
      if (newStatus !== event.status) {
        await directusRequest('PATCH', `/items/events/${event.id}`, {
          status: newStatus
        });
        
        logger.success(`${event.title}: ${event.status} → ${newStatus}`);
        logger.incrementStat('updated');
      } else {
        logger.info(`${event.title}: ${event.status} (no change)`);
      }
    }
    
    logger.info('\n✅ Event status update completed!');
    logger.printSummary();
    
  } catch (error) {
    logger.error('Fatal error during event update', error);
    process.exit(1);
  }
}

// Run the script
updateEventStatuses().then(() => {
  // Ping healthchecks.io on success
  const https = require('https');
  https.get('https://hc-ping.com/eba3c398-e211-4a3e-9dd3-5ab2e2765bac').on('error', () => {});
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
