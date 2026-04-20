# Client Handoff

This note is the operator packet for handing the project to the next owner.

## Start Here

The core project docs are:

- `README.md` - app architecture, local setup, and environment overview
- `scraper/README.md` - scraper setup, local runs, and cron/VPS commands
- `NOTES.md` - current limitations, open client questions, and infra follow-up
- `OPS_COSTS.md` - service stack and cost overview

## Stack Summary

This project is a React/Vite dashboard backed by Supabase, Netlify Functions, and Python scrapers.

- Frontend: React 19 + Vite
- Backend data/auth: Supabase
- Server-side sync endpoints: Netlify Functions
- Scrapers: Python scripts for Instagram and Reddit

## Required Access Checklist

Give the next owner access to the following as applicable:

- [ ] GitHub repository
- [ ] Netlify site
- [ ] Supabase project
- [ ] RocketAPI account
- [ ] APIFY account
- [ ] OnlyFans API provider access

## Environment Variables

### Frontend / local development

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Netlify Functions / server-side syncs

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `ONLYFANS_API_KEY`
- `TWITTER_BEARER_TOKEN`
- `APIFY_TOKEN`
- `META_GRAPH_API_VERSION` (optional)

### Scraper host

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `ROCKETAPI_KEY`

Call out clearly which credentials are already configured in production and which still need to be transferred or requested from the client/vendor.

## Next Required Infrastructure Step

The next required infra step is setting up the scraper host/VPS and cron jobs.

The Instagram and Reddit scrapers should run on an always-on machine rather than a local laptop. The next owner should:

1. Provision a small VPS or other always-on host.
2. Copy the scraper `.env` from `scraper/.env.example` and fill in the required values.
3. Create the Python virtual environment and install scraper dependencies.
4. Install the cron jobs from `scraper/README.md`.

## Open Product Questions

These items still need client confirmation:

1. OnlyFans revenue source of truth:
   - confirm whether tracking-link revenue or CRM total should drive the dashboard
2. Reddit metrics:
   - define what "number of posts" should mean
   - define whether "replies" means comments received or comments written
   - confirm whether 30d/90d windows are needed
   - confirm whether more Reddit accounts need to be added
3. Account completeness:
   - confirm whether all Instagram, TikTok, Reddit, and OnlyFans accounts are already represented

Also note:

- Instagram reach, impressions, profile visits, and story views are not available externally without account-owner Instagram Graph API access.

## Recommended Handoff Message

Use or adapt the message below when you send the repo over:

```md
Here’s the project handoff repo:

[repo link]

The stack is React/Vite + Supabase + Netlify Functions + Python scrapers.

Please start with these docs:
- README.md
- scraper/README.md
- NOTES.md
- OPS_COSTS.md

The next required infra step is setting up the scraper host/VPS and cron jobs.

Access checklist:
- [ ] GitHub
- [ ] Netlify
- [ ] Supabase
- [ ] RocketAPI
- [ ] APIFY
- [ ] OnlyFans API

Open client questions still pending:
1. OnlyFans revenue source of truth
2. Reddit metric definitions and reporting windows
3. Whether all accounts are already present in the system
```
