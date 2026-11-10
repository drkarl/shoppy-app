# Shoppy - Collaborative Smart Shopping List

A Progressive Web App (PWA) for collaborative shopping list management designed for 2-person households with offline-first architecture, real-time sync, and bilingual duplicate detection.

## Features

- **Real-time Collaboration**: Changes sync between devices in under 3 seconds
- **Offline-First**: Full functionality without internet connection
- **Bilingual Duplicate Detection**: Smart matching for English and Spanish terms (e.g., "milk" = "leche")
- **Store-Specific Organization**: Custom category ordering per store for optimized shopping routes
- **PWA**: Installable on mobile and desktop devices
- **Magic Link & OAuth**: Easy authentication with email or Google

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Offline**: Dexie.js (IndexedDB), Service Worker
- **State Management**: React Context, Dexie liveQuery
- **Testing**: Playwright (E2E), Vitest (unit)
- **Deployment**: Vercel

## Project Structure

```
shoppy/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication routes
│   ├── (app)/             # Main app routes
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── list/             # List view components
│   ├── shopping/         # Shopping mode components
│   └── providers/        # Context providers
├── lib/                   # Core business logic
│   ├── db/               # Dexie.js database
│   ├── sync/             # Sync engine
│   ├── matching/         # Duplicate detection
│   └── api/              # API client functions
├── docs/                  # Documentation
│   └── design/           # Design documents
├── supabase/             # Supabase migrations
└── tests/                # E2E and unit tests
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account (free tier)
- GitHub account

### 1. Create GitHub Repository

First, create a GitHub repository for the project:

```bash
# Initialize git (already done if you're reading this)
git branch -m main

# Create GitHub repo (you'll need appropriate permissions)
gh repo create shoppy --private --source=. --remote=origin

# Push initial commit
git push -u origin main
```

### 2. Create GitHub Issues

The project plan includes 47 issues organized into 5 phases. Run the script to create all issues:

```bash
./create-github-issues.sh
```

This will create:

- **Phase 0: Foundation** (12 issues) - Project setup, auth, basic CRUD
- **Phase 1: Duplicate Detection** (8 issues) - Parsing, normalization, fuzzy matching
- **Phase 2: Offline & Sync** (11 issues) - IndexedDB, sync queue, conflict resolution
- **Phase 3: Store Profiles** (8 issues) - Store management, shopping mode
- **Phase 4: Polish & Launch** (8 issues) - Error handling, testing, deployment

### 3. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key
3. Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. Apply database migrations (after completing issue #2):

```bash
npx supabase db push
```

### 4. Install Dependencies & Run Dev Server

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Install note:** `sharp` is an optional dependency (used by
> `npm run generate:icons` and Next.js image optimisation). On machines with a
> system libvips that `sharp` prefers over its prebuilt binary, npm skips it
> instead of failing the install. Run `SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm ci` to
> force the prebuilt binary when you need `sharp`.

## Development Workflow

### Working with Issues

1. **View all issues**:

   ```bash
   gh issue list
   ```

2. **Filter by phase**:

   ```bash
   gh issue list --label "phase-0"
   ```

3. **Start working on an issue**:

   ```bash
   gh issue develop 1 --checkout
   ```

4. **Create a PR when done**:
   ```bash
   git add .
   git commit -m "feat: implement feature from #1"
   git push
   gh pr create --fill
   ```

### Recommended Order

Follow the phases in sequence:

1. **Phase 0 (Week 1-2)**: Foundation - Start with issues #1-12
2. **Phase 1 (Week 3)**: Duplicate Detection - Issues #13-20
3. **Phase 2 (Week 4)**: Offline & Sync - Issues #21-31
4. **Phase 3 (Week 5)**: Store Profiles - Issues #32-39
5. **Phase 4 (Week 6)**: Polish & Launch - Issues #40-47

### Critical Path

The minimum viable product requires these issues in order:

```
#1 → #2 → #3 → #5 → #6 → #9 → #10 → #21 → #23 → #24 → #25 → #33 → #36 → #46
```

## Architecture

See [docs/design/architecture.md](docs/design/architecture.md) for detailed architecture documentation including:

- System context diagram
- Database schema (ERD + SQL)
- Row Level Security (RLS) policies
- Data flow diagrams
- Client-side architecture

See [docs/design/project-plan.md](docs/design/project-plan.md) for the complete task breakdown.

## Testing

### Unit Tests

```bash
npm run test
```

### E2E Tests

```bash
npm run test:e2e
```

### Lighthouse Audit

```bash
npm run lighthouse
```

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repo to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to `main`

See [docs/deployment.md](docs/deployment.md) for detailed deployment instructions (created in issue #46).

## Contributing

This is a personal project for a 2-person household, but suggestions and bug reports are welcome!

## License

See [LICENSE](LICENSE) for the license terms.

---

**Project Status**: 🚧 In Development

**Current Phase**: Phase 0 - Foundation

**Last Updated**: 2026-01-28
