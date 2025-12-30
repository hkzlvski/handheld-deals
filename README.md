# Handheld Deals - Automation Scripts

All automated maintenance and data sync scripts for Handheld Deals platform.

## Quick Start
```bash
# Run all cron jobs
npm run cron

# Development mode with auto-reload
npm run cron:dev
```

## Individual Script Testing
```bash
# Test individual scripts
npm run test:cheapshark      # Fetch deals
npm run test:steam           # Sync Steam metadata
npm run test:protondb        # Sync ProtonDB data
npm run test:battery         # Estimate battery life
npm run test:cleanup-deals   # Clean old deals
npm run test:cleanup-prefs   # Clean expired preferences
npm run test:events          # Update event status
npm run test:alerts          # Process price alerts
npm run test:stale-reviews   # Flag stale curator picks
npm run test:stale-data      # Downgrade stale data
```

## Scripts Overview

### Data Sync (External APIs)

- **fetch-cheapshark.js** - Hourly deal updates from CheapShark
- **sync-steam-data.js** - Daily metadata from Steam + SteamSpy
- **sync-protondb.js** - Every 6 hours from ProtonDB Community API
- **estimate-battery.js** - Weekly recalculation (algorithm updates)

### Maintenance

- **cleanup-old-deals.js** - Daily removal of expired/orphaned deals
- **cleanup-preferences.js** - Daily cleanup of expired user preferences
- **update-event-status.js** - Hourly event status updates (upcoming/active/ended)

### User Features

- **process-price-alerts.js** - Hourly price alert email notifications

### Data Quality

- **flag-stale-reviews.js** - Weekly flagging of reviews >6 months old
- **downgrade-stale-data.js** - Weekly downgrade of stale hand_tested data

## Schedule
```
HOURLY:
:00 - CheapShark deals
:15 - Price alerts  
:30 - Event status

EVERY 6 HOURS:
:00 - ProtonDB sync

DAILY:
2 AM - Steam metadata sync
4 AM - Deal cleanup
5 AM - Preferences cleanup

WEEKLY (Monday):
3 AM - Stale data downgrade
4 AM - Stale reviews flagging
```

## Logs

All jobs log to `/logs/cron-{job-name}.log`

View logs:
```bash
# Recent logs
tail -f logs/cron-cheapshark.log

# All today's cron activity
cat logs/cron-*.log | grep "$(date +%Y-%m-%d)"
```

## Production Deployment

### Option 1: PM2 (Recommended)
```bash
# Install PM2
npm install -g pm2

# Start scheduler
pm2 start scripts/cron-scheduler.js --name handheld-deals-cron

# Auto-start on boot
pm2 startup
pm2 save

# Monitor
pm2 logs handheld-deals-cron
pm2 monit
```

### Option 2: systemd Service

Create `/etc/systemd/system/handheld-deals-cron.service`:
```ini
[Unit]
Description=Handheld Deals Cron Scheduler
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/handheld-deals
ExecStart=/usr/bin/node /var/www/handheld-deals/scripts/cron-scheduler.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl daemon-reload
sudo systemctl enable handheld-deals-cron
sudo systemctl start handheld-deals-cron
sudo systemctl status handheld-deals-cron
```

## Troubleshooting

**Jobs not running?**
- Check scheduler is running: `ps aux | grep cron-scheduler`
- Check logs: `tail -f logs/cron-*.log`
- Verify timezone: `date` (should match Europe/Warsaw)

**Email alerts not sending?**
- Set `EMAIL_ENABLED=true` in .env
- Configure email provider (SendGrid, Mailgun, AWS SES)
- Test: `npm run test:alerts`

**Rate limiting errors?**
- Check Directus: `RATE_LIMITER_ENABLED=false` (dev) or increase `RATE_LIMITER_POINTS`
- External APIs: Respect rate limits (delays built-in)

## Development

Test individual jobs without waiting for schedule:
```bash
# Run job immediately
node scripts/fetch-cheapshark.js

# Watch logs in real-time
tail -f logs/cron-cheapshark.log
```

## Environment Variables

Required in `.env`:
```env
DIRECTUS_API_URL=http://localhost:8055
ADMIN_EMAIL=your_admin_email
ADMIN_PASSWORD=your_admin_password

# Optional
EMAIL_ENABLED=false
EMAIL_FROM=alerts@handhelddeals.com
RATE_LIMITER_ENABLED=false
```

## Monitoring & Health Checks

### Health Check Script

Verifies all cron jobs are running successfully:
```bash
npm run health
```

Checks:
- Last successful run timestamp
- Alerts if job overdue (2x expected interval)
- Sends Discord alerts for critical issues

### Healthchecks.io Integration

Dead Man's Switch monitoring for critical jobs.

Setup:
1. Create account at https://healthchecks.io (free tier)
2. Create checks for each critical job
3. Add ping URLs to .env:
```env
   HEALTHCHECK_CHEAPSHARK=https://hc-ping.com/your-uuid
   HEALTHCHECK_STEAM=https://hc-ping.com/your-uuid
   # ... etc
```

Jobs automatically ping on successful completion.

### Discord Alerts

Configure Discord webhook for error notifications:

1. Create Discord webhook in your server
2. Add to .env:
```env
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

Alert severity levels:
- 🚨 **Critical**: All operations failed, service down
- ⚠️ **High**: >50% operations failed
- ⚡ **Medium**: 10-50% operations failed  
- ℹ️ **Low**: <10% operations failed

### Monitoring Schedule

Add health check to cron:
```javascript
// Health check - every 30 minutes
cron.schedule('*/30 * * * *', logJob('health', runHealthCheck), {
  scheduled: true,
  timezone: "Europe/Warsaw"
});
```