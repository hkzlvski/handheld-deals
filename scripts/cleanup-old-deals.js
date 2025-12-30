/**
 * HANDHELD DEALS - CLEANUP OLD DEALS SCRIPT
 * 
 * Removes expired deals and orphaned deal records.
 * 
 * Features:
 * - Delete deals where expires_at is in the past
 * - Clean orphaned deals (game no longer exists)
 * - Log deletion counts for monitoring
 * 
 * Schedule: Daily at 4 AM
 * Cron: 0 4 * * *
 * 
 * Usage: node scripts/cleanup-old-deals.js
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

async function cleanupOldDeals() {
  console.log('🧹 CLEANUP OLD DEALS STARTING...\n');
  console.log(`📡 Connecting to Directus: ${DIRECTUS_URL}\n`);

  try {
    // Login
    console.log('🔐 Logging in to Directus...');
    await directus.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('✅ Logged in successfully!\n');

    let totalDeleted = 0;

    // ========================================================================
    // 1. DELETE EXPIRED DEALS
    // ========================================================================

    console.log('🗑️  Step 1: Deleting expired deals...\n');

    const now = new Date().toISOString();

    // Find expired deals
    const expiredDeals = await directus.request(
      readItems('deals', {
        filter: {
          _and: [
            { expires_at: { _nnull: true } },  // Has expiration date
            { expires_at: { _lt: now } }       // Expired
          ]
        },
        fields: ['id', 'game_id', 'store', 'expires_at']
      })
    );

    console.log(`   Found ${expiredDeals.length} expired deals`);

    if (expiredDeals.length > 0) {
      // Delete expired deals
      const expiredIds = expiredDeals.map(d => d.id);

      await directus.request(
        deleteItems('deals', expiredIds)
      );

      totalDeleted += expiredDeals.length;
      console.log(`   ✅ Deleted ${expiredDeals.length} expired deals\n`);
    } else {
      console.log(`   ✓ No expired deals to delete\n`);
    }

    // ========================================================================
    // 2. DELETE ORPHANED DEALS
    // ========================================================================

    console.log('🗑️  Step 2: Deleting orphaned deals (game no longer exists)...\n');

    // Get all deals
    const allDeals = await directus.request(
      readItems('deals', {
        fields: ['id', 'game_id']
      })
    );

    console.log(`   Checking ${allDeals.length} deals for orphans...`);

    // Get all game IDs
    const allGames = await directus.request(
      readItems('games', {
        fields: ['id']
      })
    );

    const gameIds = new Set(allGames.map(g => g.id));

    // Find orphaned deals
    const orphanedDeals = allDeals.filter(deal => !gameIds.has(deal.game_id));

    console.log(`   Found ${orphanedDeals.length} orphaned deals`);

    if (orphanedDeals.length > 0) {
      const orphanedIds = orphanedDeals.map(d => d.id);

      await directus.request(
        deleteItems('deals', orphanedIds)
      );

      totalDeleted += orphanedDeals.length;
      console.log(`   ✅ Deleted ${orphanedDeals.length} orphaned deals\n`);
    } else {
      console.log(`   ✓ No orphaned deals to delete\n`);
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================

    console.log('='.repeat(60));
    console.log('📊 CLEANUP SUMMARY');
    console.log('='.repeat(60));
    console.log(`🗑️  Total deals deleted: ${totalDeleted}`);
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log('='.repeat(60) + '\n');

    if (totalDeleted > 0) {
      console.log('✅ Cleanup complete! Database optimized.');
    } else {
      console.log('✅ Cleanup complete! No deletions needed.');
    }

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
  cleanupOldDeals()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { cleanupOldDeals };