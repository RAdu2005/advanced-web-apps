# Vercel Sync Workflow

This project keeps local-first development unchanged and generates a separate Vercel-ready branch.

## What the sync script does
- Clones your current repo state into a temp folder.
- Checks out (or creates) a deployment branch (default: `vercel`).
- Copies your current project files to that branch snapshot.
- Applies `deployment/vercel-overlay/**` on top (Vercel-specific files).
- Commits and force-pushes to GitHub.

## Command
From project root:

```powershell
npm run sync:vercel
```

Optional direct usage:

```powershell
./scripts/sync-vercel.ps1 -Branch vercel -Remote origin -CommitMessage "chore: deploy snapshot"
```

## Requirements
- The repo must be a Git repository.
- A remote (default `origin`) must be configured and authenticated.

## Vercel setup
Use two Vercel projects:

1. API project
- Root Directory: `apps/api`
- Env vars:
  - `MONGO_URI`
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN`
  - `CORS_ORIGIN` (your web app URL)
  - `EDIT_SESSION_TTL_SECONDS`

2. Web project
- Root Directory: `apps/web`
- Env var:
  - `VITE_API_URL` = deployed API URL (for example `https://your-api.vercel.app`)

After each local change, run `npm run sync:vercel` and Vercel can deploy from the `vercel` branch.
