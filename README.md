# Handheld Deals - Game Deals for Handheld Gaming PCs

Steam Deck, ROG Ally, Legion Go compatible game deals aggregator.

## Tech Stack

- **Backend:** Directus (Headless CMS)
- **Frontend:** Astro + React
- **Database:** PostgreSQL 15
- **Server:** Node.js 20.x
- **Hosting:** OVH VPS (Ubuntu 24.04)

## Project Structure
```
/var/www/handheld-deals/
├── extensions/          # Directus custom extensions
├── logs/               # Application logs
├── scripts/            # Automation scripts (CheapShark, Steam API)
├── .env               # Environment variables (not in git)
├── .gitignore
├── package.json
└── README.md
```

## Setup

See DEPLOYMENT.md for full setup instructions.

## Backup & Restore

See ~/BACKUP_RESTORE_PROCEDURE.md for database backup/restore procedures.

## Environment

- Node.js: 20.19.6
- npm: 10.8.2
- PostgreSQL: 15.15
- OS: Ubuntu 24.04 LTS

## Database

- Database: handheld_deals
- User: handheld_admin
- Backups: Daily at 2 AM, 7-day retention

## Author

Handheld Deals MVP - 2025
