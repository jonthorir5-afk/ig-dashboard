# Project Notes

## Active data sources
| Platform | Provider | Auth method |
|---|---|---|
| Instagram | RocketAPI get_media | ROCKETAPI_KEY in .env |
| Reddit | Public JSON API + over18 cookie | No credentials needed |
| TikTok | [current provider] | |
| OnlyFans | OnlyFansAPI tracking links | |

## Known limitations
- Instagram play counts (views) are suppressed by Instagram for NSFW accounts on all external scrapers except RocketAPI
- ts.moxie consistently returns views=0 — this account appears to post mostly carousels rather than reels
- Reddit API returns max 100 posts per request. Pagination is implemented and triggers automatically for active accounts. A warning is logged if pagination is insufficient.

## Pending — requires client input
1. OnlyFans revenue mismatch: dashboard uses tracking-link revenue from OnlyFansAPI. Client needs to confirm whether tracking-link revenue or CRM total is the source of truth. Ariana's twitter/c45 link flagged as a specific example.

2. Reddit metrics clarification needed before Reddit UI is finalized:
   - "Number of posts" = lifetime total or per 1d/7d/30d?
   - "Replies" = comments received or comments written?
   - Need 30d/90d windows or just 1d/7d?
   - Are there more Reddit accounts beyond the current 4?

3. Missing accounts: confirm whether all Instagram, TikTok, Reddit and OnlyFans accounts are in the system.

## Pending — infrastructure
- VPS setup: both scrapers currently run manually. For reliable daily data, move to a small always-on VPS (e.g. DigitalOcean $6/mo droplet) and set up cron jobs. See scraper/README.md for cron job commands.

## Pending — Reddit API registration
- Submitted API access request to Reddit (April 2026)
- Currently using public JSON API with over18 cookie trick
- If Reddit approves the app, migrate to PRAW for more reliable authenticated access
- Credentials will go in .env as REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET

## What is NOT possible externally (Instagram)
Reach, impressions, profile visits, and story views require account-owner Instagram Graph API access. No external scraper can access these metrics.
