# Ops Costs

This note tracks the services involved in running the dashboard and the Instagram scraper, plus which ones are still needed.

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

### Instagram Burner Account
- Purpose: authenticated observer account for `instagrapi`
- Status: needed
- Typical cost: $0
- Notes: should be treated as an operations asset, not a personal account

### instagrapi Scraper
- Purpose: replaces the old Apify-based Instagram scraping flow
- Status: needed
- Typical cost: $0 software cost
- Notes: lives in [`scraper/README.md`](/Users/melkorkadkristinsdottir/Documents/igdash/ig-dashboard/scraper/README.md)

### Local Mac Host
- Purpose: can run the daily scraper for now
- Status: acceptable short-term
- Typical cost: $0 additional cost
- Notes: only works reliably if the machine is awake and connected when the scheduled run happens

## Recommended Soon

### Small VPS
- Purpose: always-on host for the daily Instagram scraper
- Status: recommended later
- Typical cost:
  - Hetzner small cloud server: about EUR 4.99/mo before VAT for a low-end instance plus IPv4
- Notes:
  - makes the scraper independent of a local Mac
  - better place for cron, logs, `.env`, and `session.json`
  - likely the cleanest next infra upgrade
- Sources:
  - https://www.hetzner.com/cloud/
  - https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/

### Residential Proxy
- Purpose: reduces Instagram session instability and lowers risk of `login_required` / challenge loops
- Status: strongly recommended
- Typical cost:
  - Decodo residential plans: roughly $11.25/mo for 3 GB, $35/mo for 10 GB
  - Pay-as-you-go options may be around $4/GB
- Notes:
  - especially useful once the scraper moves to a VPS
  - the main operational stability add-on still missing from the setup
- Source: https://decodo.com/proxies/residential-proxies/pricing

## Not Needed For Instagram Anymore

### Apify
- Purpose before: Instagram scraping via actors
- Status: no longer needed for Instagram if the `instagrapi` pipeline is the source of truth
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
- Instagram burner account
- `instagrapi` scraper
- local Mac running a daily scheduled job

Expected rough monthly cost:
- around $0 to $34/mo depending on current Netlify and Supabase plan choices

### Better Production Version
- Netlify
- Supabase
- Instagram burner account
- `instagrapi` scraper
- small VPS
- residential proxy

Expected rough monthly cost:
- around $16 to $74/mo plus VAT, depending on plan choices

## Action Notes

- Keep: Netlify, Supabase, `instagrapi`
- Add later: VPS
- Add when possible: residential proxy
- Retire for Instagram: Apify, Make.com
- Re-check prices before purchase since vendor pricing can change
