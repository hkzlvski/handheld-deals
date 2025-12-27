# Directus Custom Extensions - Handheld Deals

This directory contains custom Directus extensions for the Handheld Deals project.

## Extension Types

### `/endpoints` - Custom API Routes
Custom REST API endpoints for specialized functionality.

**Examples (to be built in Phase B/C):**
- `/custom/track-click` - Affiliate click tracking
- `/custom/featured-deals` - Homepage featured deals algorithm
- `/custom/stats` - Analytics endpoints

### `/hooks` - Automation & Triggers
Event-driven automation hooks.

**Examples (to be built in Phase A.4/B):**
- `update-deal-status` - Auto-update expired deals
- `cache-invalidation` - Clear cache on data changes
- `webhook-notifications` - External service notifications

### `/interfaces` - Admin UI Custom Fields
Custom input components for Directus admin panel.

**Examples (future):**
- `battery-drain-selector` - Custom UI for battery drain levels
- `compatibility-checker` - Visual compatibility status

### `/displays` - Data Display Components
Custom ways to display data in admin panel.

### `/layouts` - Collection Layout Types
Custom layouts for viewing collection data.

### `/modules` - Admin Panel Modules
Full admin panel pages/modules.

### `/panels` - Dashboard Panels
Custom dashboard widgets.

## Development

Extensions are auto-reloaded when `EXTENSIONS_AUTO_RELOAD=true` in `.env`.

To create a new extension:
```bash
npx directus extensions create
```

## Documentation

- [Directus Extensions Docs](https://docs.directus.io/extensions/)
- [Extensions SDK](https://docs.directus.io/extensions/creating-extensions.html)

## Status

**Phase A (MVP):** Placeholder structure only
**Phase B/C:** Will populate with custom endpoints and hooks
**Phase D+:** Advanced UI extensions as needed
