# Contributing to Handheld Deals

## Git Workflow

### Branches

- **`main`** - Production-ready code (deploy from here)
- **`development`** - Active development (merge features here first)
- **`feature/*`** - Feature branches (branch from development)
- **`fix/*`** - Bug fix branches

### Development Flow

1. **Start new feature:**
```bash
   git checkout development
   git pull origin development
   git checkout -b feature/feature-name
```

2. **Make changes and commit:**
```bash
   git add .
   git commit -m "feat: add feature description"
```

3. **Push feature branch:**
```bash
   git push -u origin feature/feature-name
```

4. **Create Pull Request on GitHub:**
   - From: `feature/feature-name`
   - To: `development`

5. **After merge, delete feature branch:**
```bash
   git checkout development
   git pull origin development
   git branch -d feature/feature-name
```

### Commit Message Convention

Use conventional commits format:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Code style (formatting, semicolons, etc.)
- `refactor:` - Code refactoring
- `perf:` - Performance improvement
- `test:` - Adding tests
- `chore:` - Maintenance tasks

**Examples:**
```
feat: add CheapShark API integration
fix: resolve database connection timeout
docs: update README deployment section
chore: update dependencies
```

## Setup for New Developers

1. **Clone repository:**
```bash
   git clone https://github.com/YOUR_USERNAME/handheld-deals.git
   cd handheld-deals
```

2. **Install dependencies:**
```bash
   npm install
```

3. **Setup environment:**
```bash
   cp .env.example .env
   # Edit .env with your credentials
```

4. **Initialize database:**
```bash
   npx directus bootstrap
```

5. **Start development:**
```bash
   npx directus start
```

## Database

- **Backups:** Daily at 2 AM, 7-day retention
- **Restore:** See `~/BACKUP_RESTORE_PROCEDURE.md`

## Deployment

See `DEPLOYMENT.md` (to be created in Phase E)
