# Ops Costs

This note tracks the services involved in running the dashboard and the current Instagram + Reddit scraper stack, plus which ones are still needed.

All prices below are approximate and should be re-checked before making billing decisions.

## Needed Now

### Netlify
- Purpose: hosts the React dashboard and Netlify functions
- Status: needed
- Typical cost:
  - Free: $0
  - Personal: $9/mo
  - Pro: $20/seat/mo
- Notes: if the current site and functions fit within the active plan limits, no change is needed
- Source: https://www.netlify.com/pricing/

### Supabase
- Purpose: primary database/storage/auth backend
- Status: needed
- Typical cost:
  - Free: $0
  - Pro: about $25/mo per organization, with included compute credits
- Notes: this is the core system of record for `accounts`, `snapshots`, and `posts`
- Sources:
  - https://supabase.com/docs/guides/platform/billing-on-supabase
  - https://supabase.com/docs/guides/platform/billing-faq

### RocketAPI
- Purpose: Instagram scraping provider for follower counts, posts, and reel play counts
- Status: needed
- Typical cost: depends on the active RocketAPI plan
- Notes: this is now the production Instagram data source

### Local Mac Host
- Purpose: can run the daily scraper for now
- Status: acceptable short-term
- Typical cost: $0 additional cost
- Notes: only works reliably if the machine is awake and connected when the scheduled run happens

## Recommended Soon

### Small VPS
- Purpose: always-on host for the daily Instagram + Reddit scrapers
- Status: recommended later
- Typical cost:
  - DigitalOcean Droplet, 2 GB RAM: about $12/mo
- Notes:
  - makes both scrapers independent of a local Mac
  - better place for `systemd` timers, logs, and `.env`
  - likely the cleanest next infra upgrade
- Sources:
  - https://www.digitalocean.com/pricing/droplets

## Not Needed For Instagram Anymore

### Apify
- Purpose before: Instagram scraping via actors
- Status: no longer needed for Instagram if the RocketAPI pipeline is the source of truth
- Typical cost:
  - Starter: about $29/mo plus usage
- Why not needed:
  - the new scraper now writes directly to Supabase
  - the old Apify flow was unreliable for age-restricted Instagram accounts
- Source: https://apify.com/pricing

### Make.com
- Purpose before: orchestration layer for the old Instagram scraping pipeline
- Status: no longer needed for Instagram if the old Make/Apify scenario is retired
- Typical cost:
  - Core: about $9/mo
- Why not needed:
  - the new scraper no longer depends on Make to run or write results
- Source: https://www.make.com/en/pricing

## Current Best Stack

### Lowest-Cost Working Version
- Netlify
- Supabase
- RocketAPI
- local Mac running a daily scheduled job

Expected rough monthly cost:
- around $0 to $34/mo depending on current Netlify and Supabase plan choices

### Better Production Version
- Netlify
- Supabase
- RocketAPI
- small VPS

Expected rough monthly cost:
- around $21 to $46/mo depending on plan choices and current Netlify/Supabase tiers

## Action Notes

- Keep: Netlify, Supabase, RocketAPI
- Add later: VPS
- Retire for Instagram: Apify, Make.com
- Re-check prices before purchase since vendor pricing can change
