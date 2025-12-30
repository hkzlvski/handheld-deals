/**
 * HANDHELD DEALS - FLAG STALE REVIEWS SCRIPT
 * 
 * Identifies curator picks needing retesting (6+ months old).
 * 
 * Features:
 * - Find curator_picks where last_verified > 6 months ago
 * - Downgrade confidence_level from high to medium
 * - Add note about needing re-testing
 * - Log flagged reviews for admin review queue
 * 
 * Schedule: Weekly Monday at 4 AM
 * Cron: 0 4 (star) (star) 1
 * 
 * Usage: node scripts/flag-stale-reviews.js
 */

require('dotenv').config();
const { createDirectus, rest, readItems, updateItem, authentication } = require('@directus/sdk');

// ============================================================================
// CONFIGURATION
// ============================================================================

const DIRECTUS_URL = process.env.DIRECTUS_API_URL || 'http://localhost:8055';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Staleness threshold (6 months)
const STALE_THRESHOLD_DAYS = 180;

// ============================================================================
// DIRECTUS CLIENT
// ============================================================================

const directus = createDirectus(DIRECTUS_URL)
  .with(authentication('json'))
  .with(rest());

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function flagStaleReviews() {
  console.log('🚩 FLAG STALE REVIEWS STARTING...\n');
  console.log(`📡 Connecting to Directus: ${DIRECTUS_URL}`);
  console.log(`📅 Staleness threshold: ${STALE_THRESHOLD_DAYS} days (6 months)\n`);

  try {
    // Login
    console.log('🔐 Logging in to Directus...');
    await directus.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('✅ Logged in successfully!\n');

    // Calculate cutoff date (6 months ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - STALE_THRESHOLD_DAYS);
    const cutoffISO = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD format

    console.log(`📅 Cutoff date: ${cutoffISO}\n`);

    // Fetch stale reviews
    console.log('📥 Fetching stale curator picks...');

    const staleReviews = await directus.request(
      readItems('curator_picks', {
        filter: {
          _and: [
            { status: { _eq: 'published' } },           // Only published reviews
            { last_verified: { _lt: cutoffISO } }       // Last verified before cutoff
          ]
        },
        fields: ['id', 'game_id', 'last_verified', 'confidence_level', 'curator_note'],
        limit: -1
      })
    );

    console.log(`✅ Found ${staleReviews.length} stale reviews\n`);

    if (staleReviews.length === 0) {
      console.log('ℹ️  No stale reviews to flag');
      console.log('✅ Flagging complete!\n');
      return;
    }

    // Process stale reviews
    let flagged = 0;
    let alreadyFlagged = 0;

    console.log('⚙️  Processing stale reviews...\n');

    for (const review of staleReviews) {
      try {
        // Calculate age
        const lastVerified = new Date(review.last_verified);
        const ageInDays = Math.floor((Date.now() - lastVerified) / (1000 * 60 * 60 * 24));
        const ageInMonths = Math.floor(ageInDays / 30);

        console.log(`📌 Review ID: ${review.id}`);
        console.log(`   Last verified: ${review.last_verified}`);
        console.log(`   Age: ${ageInMonths} months (${ageInDays} days)`);
        console.log(`   Current confidence: ${review.confidence_level}`);

        // Check if already flagged
        const alreadyHasFlag = review.curator_note &&
          review.curator_note.includes('Flagged for re-testing');

        if (alreadyHasFlag) {
          console.log(`   ✓ Already flagged, skipping\n`);
          alreadyFlagged++;
          continue;
        }

        // Prepare updates
        const updates = {};

        // Downgrade confidence if currently high
        if (review.confidence_level === 'high') {
          updates.confidence_level = 'medium';
          console.log(`   🔽 Downgrading confidence: high → medium`);
        }

        // Add flag to notes
        const flagNote = `[AUTO-FLAGGED] Needs re-testing (${ageInMonths} months old, last verified: ${review.last_verified})`;

        if (review.curator_note) {
          updates.curator_note = `${review.curator_note}\n\n${flagNote}`;
        } else {
          updates.curator_note = flagNote;
        }

        // Update review
        if (Object.keys(updates).length > 0) {
          await directus.request(
            updateItem('curator_picks', review.id, updates)
          );

          flagged++;
          console.log(`   ✅ Flagged for re-testing\n`);
        }

      } catch (error) {
        console.error(`   ❌ Error flagging review ${review.id}:`, error.message);
      }
    }

    // Summary
    console.log('='.repeat(60));
    console.log('📊 STALE REVIEWS SUMMARY');
    console.log('='.repeat(60));
    console.log(`🚩 Newly flagged: ${flagged} reviews`);
    console.log(`✓ Already flagged: ${alreadyFlagged} reviews`);
    console.log(`📊 Total stale: ${staleReviews.length} reviews`);
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log('='.repeat(60) + '\n');

    if (flagged > 0) {
      console.log('⚠️  Admin action required: Review flagged items in Directus');
    }

    console.log('✅ Stale review flagging complete!');

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
  flagStaleReviews()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { flagStaleReviews };