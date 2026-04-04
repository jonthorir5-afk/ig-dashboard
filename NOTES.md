# Follow-Up Notes

## Figure Out Later

- OnlyFans revenue mismatch: dashboard is using OnlyFansAPI tracking-link revenue, which may use a narrower attribution model than the CRM numbers. Ariana's `twitter` / `c45` link is one confirmed example to revisit later. Compare the exact OnlyFansAPI response fields against the CRM's lifetime revenue definition before changing the dashboard logic.
- Instagram sync blocker: Apify is returning `usage_exceeded` for some Instagram follower-count runs. Increase Apify usage / credits / actor access first, then resume testing the Instagram follower sync flow.
- Instagram follow-up: Apify and Netlify credits were increased on 2026-04-02, so the Instagram follower sync flow should be re-tested and stabilized next.
- Meta Instagram auth follow-up: the new Meta-backed Instagram connection flow is scaffolded, but Instagram OAuth is still failing on Instagram's side with `Sorry, this page isn't available` before the callback is reached. Redirect URI appears correct, so the next likely blockers are Meta app/use-case configuration or the requested scope. Resume by testing with `META_INSTAGRAM_SCOPES=instagram_business_basic` and re-checking the Meta Instagram Login setup.
- VPS follow-up: move the new `scraper/` Instagram pipeline onto a small always-on VPS later so the daily `instagrapi` run does not depend on a local Mac staying awake. When doing this, also add the burner account `session.json`, `.env`, cron job, logs directory, and ideally a residential proxy.

## Known Limitation: Views 7D shows 0 for most Instagram accounts

**Date discovered:** 2026-04-04  
**Status:** Known limitation, not a bug

### What's happening

The `Views 7D` column in the dashboard maps to `ig_views_7d` in the snapshots table. This field is populated by summing `view_count` across the last 7 scraped posts from Instagram's mobile API.

### Why it shows 0

Instagram's mobile API only returns `view_count` on video/reel posts (`media_type == 2`). For photo posts it is always `0`. More importantly, for NSFW/age-restricted accounts specifically, Instagram suppresses view count data more aggressively than for regular accounts when accessed via an external scraper session. This means even reel view counts frequently return as `0` despite the accounts having real views in their Instagram Insights.

### What was tried

- `instagrapi` scraper correctly reads `media.view_count` per post
- summing is implemented correctly in `scrape.py` (commit `39e12f7`)
- `ts.moxie` shows partial data (`359` views) confirming the field works
- the remaining zeros are a data availability limitation, not a code bug

### Workarounds

1. **Accept it** — follower count, engagement rate, and likes/comments are accurate and are the more meaningful metrics for this use case
2. **Manual input** — account owners can log weekly reel views from their Instagram Insights and enter them manually in the dashboard
3. **Official API** — if accounts ever connect via Meta's Graph API (requires linking to a Facebook Business Page), real reach and impressions data would be available automatically

### What is NOT possible externally

Reach, impressions, profile visits, and story views are gated behind Instagram's official Graph API and require account-owner authentication. No external scraper can reliably access these for any account.
