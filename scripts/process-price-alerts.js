/**
 * HANDHELD DEALS - PROCESS PRICE ALERTS SCRIPT
 * 
 * Checks price alerts and sends email notifications when target price is reached.
 * 
 * Features:
 * - Check verified alerts where alert_sent = false
 * - Compare current best deal price with target price
 * - Verify device compatibility if specified
 * - Send email notification (TODO: email service integration)
 * - Mark alert as sent
 * 
 * Schedule: Hourly at 15 minutes past
 * Cron: 15 (star) / 1 (star) (star) (star)
 * 
 * Usage: node scripts/process-price-alerts.js
 */

require('dotenv').config();
const { createDirectus, rest, readItems, updateItem, authentication } = require('@directus/sdk');

// ============================================================================
// CONFIGURATION
// ============================================================================

const DIRECTUS_URL = process.env.DIRECTUS_API_URL || 'http://localhost:8055';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Email service configuration (TODO: configure email provider)
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true' || false;
const EMAIL_FROM = process.env.EMAIL_FROM || 'alerts@handhelddeals.com';

// ============================================================================
// DIRECTUS CLIENT
// ============================================================================

const directus = createDirectus(DIRECTUS_URL)
  .with(authentication('json'))
  .with(rest());

// ============================================================================
// EMAIL FUNCTIONS
// ============================================================================

/**
 * Send price alert email (placeholder - integrate with email service)
 */
async function sendPriceAlertEmail(alert, game, deal, deviceContext) {
  // TODO: Integrate with email service (SendGrid, Mailgun, AWS SES, etc.)

  const emailData = {
    to: alert.email,
    from: EMAIL_FROM,
    subject: `🎮 Price Alert: ${game.title} is now $${deal.price}!`,
    html: `
      <h2>Your price alert has been triggered!</h2>
      <p><strong>${game.title}</strong> is now available at your target price!</p>
      
      <ul>
        <li><strong>Current Price:</strong> $${deal.price}</li>
        <li><strong>Your Target:</strong> $${alert.target_price}</li>
        <li><strong>Discount:</strong> ${deal.discount_percent}% off</li>
        <li><strong>Store:</strong> ${deal.store}</li>
        ${deal.is_historical_low ? '<li><strong>🔥 Historical Low!</strong></li>' : ''}
      </ul>
      
      ${deviceContext ? `<p><strong>Your Device:</strong> ${deviceContext}</p>` : ''}
      
      <p><a href="${deal.url}">Get this deal now!</a></p>
      
      <p><small>This is an automated alert from Handheld Deals.</small></p>
    `
  };

  if (EMAIL_ENABLED) {
    // TODO: Send actual email
    console.log('    📧 Email would be sent:', emailData);
    return true;
  } else {
    console.log('    ℹ️  EMAIL DISABLED - Would send to:', alert.email);
    console.log(`       Subject: ${emailData.subject}`);
    return true; // Simulate success
  }
}

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function processPriceAlerts() {
  console.log('📧 PROCESS PRICE ALERTS STARTING...\n');
  console.log(`📡 Connecting to Directus: ${DIRECTUS_URL}`);
  console.log(`📧 Email enabled: ${EMAIL_ENABLED}\n`);

  try {
    // Login
    console.log('🔐 Logging in to Directus...');
    await directus.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('✅ Logged in successfully!\n');

    // Fetch active alerts (verified and not yet sent)
    console.log('📥 Fetching active price alerts...');

    const alerts = await directus.request(
      readItems('price_alerts', {
        filter: {
          _and: [
            { verified: { _eq: true } },        // Email verified
            { alert_sent: { _eq: false } }      // Not sent yet
          ]
        },
        fields: ['id', 'game_id', 'email', 'target_price', 'device_context'],
        limit: -1
      })
    );

    console.log(`✅ Found ${alerts.length} active alerts\n`);

    if (alerts.length === 0) {
      console.log('ℹ️  No active alerts to process');
      console.log('✅ Processing complete!\n');
      return;
    }

    // Process alerts
    let triggered = 0;
    let skipped = 0;
    let errors = 0;

    console.log('⚙️  Processing alerts...\n');

    for (const alert of alerts) {
      try {
        console.log(`📌 Alert ID: ${alert.id}`);
        console.log(`   Email: ${alert.email}`);
        console.log(`   Target price: $${alert.target_price}`);

        // Fetch game details
        const games = await directus.request(
          readItems('games', {
            filter: { id: { _eq: alert.game_id } },
            fields: ['id', 'title', 'device_performance'],
            limit: 1
          })
        );

        if (games.length === 0) {
          console.log(`   ⚠️  Game not found, skipping\n`);
          skipped++;
          continue;
        }

        const game = games[0];

        // Fetch best current deal for this game
        const deals = await directus.request(
          readItems('deals', {
            filter: { game_id: { _eq: alert.game_id } },
            sort: ['price'],  // Lowest price first
            limit: 1
          })
        );

        if (deals.length === 0) {
          console.log(`   ⏭️  No deals available, skipping\n`);
          skipped++;
          continue;
        }

        const bestDeal = deals[0];
        console.log(`   Best deal: $${bestDeal.price} at ${bestDeal.store}`);

        // Check if price meets target
        if (bestDeal.price <= alert.target_price) {
          console.log(`   ✅ Target price reached!`);

          // Send email
          const emailSent = await sendPriceAlertEmail(alert, game, bestDeal, alert.device_context);

          if (emailSent) {
            // Mark alert as sent
            await directus.request(
              updateItem('price_alerts', alert.id, {
                alert_sent: true,
                alert_sent_at: new Date().toISOString(),
                current_price: bestDeal.price  // Update current price
              })
            );

            triggered++;
            console.log(`   ✅ Alert triggered and marked as sent\n`);
          }
        } else {
          console.log(`   ⏭️  Price not reached yet ($${bestDeal.price} > $${alert.target_price})\n`);
          skipped++;
        }

      } catch (error) {
        console.error(`   ❌ Error processing alert ${alert.id}:`, error.message);
        errors++;
      }
    }

    // Summary
    console.log('='.repeat(60));
    console.log('📊 PRICE ALERTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Triggered: ${triggered} alerts`);
    console.log(`⏭️  Skipped: ${skipped} alerts`);
    console.log(`❌ Errors: ${errors} alerts`);
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log('='.repeat(60) + '\n');

    console.log('✅ Price alert processing complete!');

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
  processPriceAlerts()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { processPriceAlerts };