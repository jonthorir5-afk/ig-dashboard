# IG Dashboard

This repo contains the current creator-ops dashboard used to track models, accounts, snapshots, benchmarks, alerts, operators, and OnlyFans link mappings.

The live product is a React/Vite frontend backed by Supabase, Netlify functions, and Python scrapers for Instagram and Reddit. It is no longer a Google Sheets or PIN-based dashboard.

## Architecture

- Frontend: React 19 + Vite
- Backend data: Supabase
- Server-side sync endpoints: Netlify Functions in `netlify/functions/`
- Scheduled/manual scraping: Python scripts in `scraper/`
- Database reference:
  - canonical schema snapshot: `supabase-schema.sql`
  - incremental SQL history: `supabase/migrations/`

## Current App Surface

- `src/pages/` contains the active route screens
- `src/lib/api.js` contains the frontend Supabase data access layer
- `src/contexts/AuthContext.jsx` handles Supabase auth + demo mode
- `netlify/functions/` contains platform sync endpoints used by the Data Entry screen
- `scraper/README.md` documents scraper setup and cron/VPS usage
- `NOTES.md` contains current limitations, infrastructure follow-up, and client questions

## Local Development

Install dependencies:

```bash
npm install
```

Run the app locally:

```bash
npm run dev
```

Build a production bundle:

```bash
npm run build
```

Validate the codebase:

```bash
npm run lint
```

## Frontend Environment Variables

Create a local `.env` file for Vite with:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

These are used by the browser app for auth and data reads/writes permitted by Supabase policies.

## Netlify Function Environment Variables

The deployed Netlify site uses server-side environment variables for sync jobs. Depending on which platform syncs are enabled, the function environment may include:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `ONLYFANS_API_KEY`
- `TWITTER_BEARER_TOKEN`
- `APIFY_TOKEN`
- `META_GRAPH_API_VERSION` (optional)

## Scrapers

Python scrapers live under `scraper/`:

- `scrape.py` for Instagram via RocketAPI
- `scrape_reddit.py` for Reddit public JSON endpoints

For setup, local runs, and cron/VPS instructions, use:

- `scraper/README.md`

## Operations Notes

- Instagram and Reddit can be refreshed either from the scraper environment or through the dashboard/server-side sync flows depending on platform.
- The Data Entry page includes:
  - manual snapshot entry
  - CSV import
  - API sync
  - OnlyFans tracking-link mapping
- Demo mode still exists for frontend exploration, but the real product flow uses Supabase auth and live database records.

## Handoff References

- Scraper setup and cron guidance: `scraper/README.md`
- Current project notes / limitations / client questions: `NOTES.md`
- Cost and service overview: `OPS_COSTS.md`
- Client handoff packet / transfer checklist: `CLIENT_HANDOFF.md`
