require('dotenv').config();
const { createDirectus, rest, authentication } = require('@directus/sdk');

let directusClient = null;

async function getDirectusClient() {
  if (directusClient) return directusClient;

  try {
    const client = createDirectus(process.env.DIRECTUS_API_URL || process.env.DIRECTUS_URL || 'http://localhost:8055')
      .with(authentication())
      .with(rest());

    // Login
    await client.login(
      process.env.DIRECTUS_ADMIN_EMAIL,
      process.env.DIRECTUS_ADMIN_PASSWORD
    );

    console.log('✅ Connected to Directus');
    directusClient = client;
    return client;
  } catch (error) {
    console.error('❌ Failed to connect to Directus:', error.message);
    throw error;
  }
}

module.exports = { getDirectusClient };
