# Shoppy - Quick Setup Guide

This guide will help you get the project up and running with GitHub issues created.

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] Git installed and configured
- [ ] GitHub CLI (`gh`) installed and authenticated
- [ ] Supabase account created

## Step-by-Step Setup

### Step 1: Create GitHub Repository

Since the git repo is initialized locally, you need to create the GitHub repository and push:

```bash
# Ensure you're on the main branch
git branch -m main

# Create the GitHub repository
# Option A: Via GitHub CLI (if you have repo creation permissions)
gh repo create shoppy --private --source=. --remote=origin

# Option B: Via GitHub Web UI
# 1. Go to https://github.com/new
# 2. Create a repository named "shoppy" (private recommended)
# 3. Don't initialize with README (we already have files)
# 4. Copy the remote URL and run:
git remote add origin https://github.com/YOUR-USERNAME/shoppy.git

# Push the initial commit
git push -u origin main
```

### Step 2: Create GitHub Issues

Once the repository is created, run the issue creation script:

```bash
./create-github-issues.sh
```

This will create 47 issues organized into 5 phases. The script will show progress as it creates each issue.

**What gets created:**

- 12 issues for Phase 0 (Foundation)
- 8 issues for Phase 1 (Duplicate Detection)
- 11 issues for Phase 2 (Offline & Sync)
- 8 issues for Phase 3 (Store Profiles)
- 8 issues for Phase 4 (Polish & Launch)

Each issue includes:

- Clear title and description
- Acceptance criteria in Given/When/Then format
- Dependencies on other issues
- Labels for phase and type (feature/chore)
- Files/areas affected

### Step 3: Verify Issues

Check that all issues were created successfully:

```bash
# List all issues
gh issue list

# View issues by phase
gh issue list --label "phase-0"
gh issue list --label "phase-1"
gh issue list --label "phase-2"
gh issue list --label "phase-3"
gh issue list --label "phase-4"

# Open the project in your browser
gh repo view --web
```

### Step 4: Set Up Supabase

1. **Create Supabase Project**:
   - Go to https://supabase.com
   - Click "New Project"
   - Choose a name (e.g., "shoppy")
   - Generate a strong password
   - Select a region close to you
   - Wait for project setup (2-3 minutes)

2. **Get Your Credentials**:
   - Go to Project Settings → API
   - Copy "Project URL"
   - Copy "anon public" key

3. **Create Environment File**:

   ```bash
   cat > .env.local << 'EOF'
   NEXT_PUBLIC_SUPABASE_URL=your-project-url-here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   EOF
   ```

   Replace the placeholder values with your actual Supabase credentials.

### Step 5: Start Development

Now you're ready to start implementing! Begin with Phase 0:

```bash
# View Phase 0 issues
gh issue list --label "phase-0"

# Start with issue #1 (Project setup)
gh issue view 1

# Create a branch and start working
gh issue develop 1 --checkout
```

## Development Workflow

### Working on an Issue

1. **Pick an issue** from the current phase (start with phase-0)
2. **Create a branch**:
   ```bash
   gh issue develop <issue-number> --checkout
   ```
3. **Implement the feature** following the acceptance criteria
4. **Test your changes** (see issue's "Testing Expectations")
5. **Commit your work**:
   ```bash
   git add .
   git commit -m "feat: implement <feature> (#<issue-number>)"
   ```
6. **Push and create PR**:
   ```bash
   git push
   gh pr create --fill
   ```
7. **Link the PR to the issue** (automatically done if you use `#<issue-number>` in commit message)

### Issue Dependencies

Many issues depend on others. Check the "Dependencies" section in each issue:

- **"Depends on #N"** means issue #N must be completed first
- The script already handles this - just follow the issue numbers sequentially

### Recommended Order

**Week 1-2 (Phase 0: Foundation)**

1. #1 - Next.js setup
2. #2 - Supabase schema
3. #3 - Authentication
4. #4 - Seed categories
5. #5 - Household management
6. #6 - List CRUD
7. #7 - Invite flow
8. #8 - Auth guards
9. #9 - Add item API
10. #10 - List view UI
11. #11 - PWA manifest
12. #12 - Service worker

Continue with Phase 1 after Phase 0 is complete.

## Troubleshooting

### GitHub CLI Authentication

If `gh` commands fail:

```bash
# Check authentication status
gh auth status

# Login if needed
gh auth login
```

### Repository Already Exists

If you get "repository already exists" error:

```bash
# Check existing remote
git remote -v

# If remote exists, just push
git push -u origin main
```

### Issue Creation Fails

If some issues fail to create:

- Check your GitHub token permissions
- Ensure you have write access to the repository
- Re-run the script (it's idempotent-safe)

### Supabase Connection Issues

If you can't connect to Supabase:

1. Verify `.env.local` has correct values
2. Check that values don't have quotes or extra spaces
3. Restart the dev server: `npm run dev`

## Next Steps

After setup is complete:

1. ✅ GitHub repository created
2. ✅ All 47 issues created
3. ✅ Supabase project configured
4. ✅ Environment variables set
5. **→ Start with Issue #1**: Set up Next.js project

Good luck! 🚀

---

**Need help?** Check:

- [Architecture Design](docs/design/architecture.md) - Technical details
- [Project Plan](docs/design/project-plan.md) - Full task breakdown
- [README.md](README.md) - Project overview
