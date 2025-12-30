/**
 * HANDHELD DEALS - UPDATE EVENT STATUS SCRIPT
 * 
 * Automatically updates event status based on current date.
 * 
 * Logic:
 * - upcoming: current date < start_date
 * - active: start_date <= current date <= end_date
 * - ended: current date > end_date
 * 
 * Schedule: Hourly at 30 minutes past every hour
 * Cron: 30 (star) / 1 (star) (star) (star) (star)
 * 
 * Usage: node scripts/update-event-status.js
 */

require('dotenv').config();
const { createDirectus, rest, readItems, updateItem, authentication } = require('@directus/sdk');

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
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine event status based on dates
 */
function determineStatus(startDate, endDate) {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now < start) {
    return 'upcoming';
  } else if (now >= start && now <= end) {
    return 'active';
  } else {
    return 'ended';
  }
}

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function updateEventStatus() {
  console.log('📅 UPDATE EVENT STATUS STARTING...\n');
  console.log(`📡 Connecting to Directus: ${DIRECTUS_URL}\n`);

  try {
    // Login
    console.log('🔐 Logging in to Directus...');
    await directus.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('✅ Logged in successfully!\n');

    // Fetch all events
    console.log('📥 Fetching events...');

    const events = await directus.request(
      readItems('events', {
        fields: ['id', 'title', 'start_date', 'end_date', 'status'],
        limit: -1  // Get all events
      })
    );

    console.log(`✅ Found ${events.length} events\n`);

    if (events.length === 0) {
      console.log('ℹ️  No events to process');
      return;
    }

    // Process events
    let updated = 0;
    let unchanged = 0;

    const statusCounts = {
      upcoming: 0,
      active: 0,
      ended: 0
    };

    console.log('⚙️  Processing events...\n');

    for (const event of events) {
      const newStatus = determineStatus(event.start_date, event.end_date);

      // Track status distribution
      statusCounts[newStatus]++;

      // Update if status changed
      if (event.status !== newStatus) {
        console.log(`📌 "${event.title}"`);
        console.log(`   ${event.status} → ${newStatus}`);

        await directus.request(
          updateItem('events', event.id, {
            status: newStatus
          })
        );

        updated++;
        console.log(`   ✅ Updated\n`);
      } else {
        unchanged++;
      }
    }

    // Summary
    console.log('='.repeat(60));
    console.log('📊 EVENT STATUS SUMMARY');
    console.log('='.repeat(60));
    console.log(`🔄 Updated: ${updated} events`);
    console.log(`✓ Unchanged: ${unchanged} events`);
    console.log('');
    console.log('📊 Current Status Distribution:');
    console.log(`   🔵 Upcoming: ${statusCounts.upcoming} events`);
    console.log(`   🟢 Active: ${statusCounts.active} events`);
    console.log(`   🔴 Ended: ${statusCounts.ended} events`);
    console.log('='.repeat(60) + '\n');

    console.log('✅ Event status update complete!');

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
  updateEventStatus()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { updateEventStatus };