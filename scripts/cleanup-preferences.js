/**
 * HANDHELD DEALS - CLEANUP PREFERENCES SCRIPT
 * 
 * Removes expired anonymous user preferences.
 * 
 * Logic:
 * - Delete user_preferences where expires_at < now
 * - Log count for analytics
 * 
 * Schedule: Daily at 5 AM
 * Cron: 0 5 (star) (star) (star)
 * 
 * Usage: node scripts/cleanup-preferences.js
 */

require('dotenv').config();
const { createDirectus, rest, readItems, deleteItems, authentication } = require('@directus/sdk');

// ============================================================================
// CONFIGURATION
// ============================================================================

const DIRECTUS_URL = process.env.DIRECTUS_API_URL || 'http://localhost:8055';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// ============================================================================
// DIRECTUS CLIENT
// ============================================================================

const directus = createDirectus(DIRECTUS_URL)
  .with(authentication('json'))
  .with(rest());

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function cleanupPreferences() {
  console.log('🧹 CLEANUP PREFERENCES STARTING...\n');
  console.log(`📡 Connecting to Directus: ${DIRECTUS_URL}\n`);

  try {
    // Login
    console.log('🔐 Logging in to Directus...');
    await directus.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('✅ Logged in successfully!\n');

    // Get current timestamp
    const now = new Date().toISOString();

    // Find expired preferences
    console.log('📥 Fetching expired preferences...');

    const expiredPrefs = await directus.request(
      readItems('user_preferences', {
        filter: {
          _and: [
            { expires_at: { _nnull: true } },  // Has expiration date
            { expires_at: { _lt: now } }       // Expired
          ]
        },
        fields: ['id', 'device', 'created_at', 'expires_at'],
        limit: -1
      })
    );

    console.log(`✅ Found ${expiredPrefs.length} expired preferences\n`);

    if (expiredPrefs.length === 0) {
      console.log('ℹ️  No expired preferences to delete');
      console.log('✅ Cleanup complete!\n');
      return;
    }

    // Calculate age statistics
    const ages = expiredPrefs.map(pref => {
      const created = new Date(pref.created_at);
      const expired = new Date(pref.expires_at);
      const ageInDays = Math.floor((expired - created) / (1000 * 60 * 60 * 24));
      return ageInDays;
    });

    const avgAge = Math.floor(ages.reduce((sum, age) => sum + age, 0) / ages.length);

    // Delete expired preferences
    console.log('🗑️  Deleting expired preferences...\n');

    const expiredIds = expiredPrefs.map(p => p.id);

    await directus.request(
      deleteItems('user_preferences', expiredIds)
    );

    console.log(`✅ Deleted ${expiredPrefs.length} expired preferences\n`);

    // Summary
    console.log('='.repeat(60));
    console.log('📊 CLEANUP SUMMARY');
    console.log('='.repeat(60));
    console.log(`🗑️  Total deleted: ${expiredPrefs.length} preferences`);
    console.log(`📅 Average age: ${avgAge} days`);
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log('='.repeat(60) + '\n');

    console.log('✅ Cleanup complete! Database optimized.');

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
  cleanupPreferences()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { cleanupPreferences };