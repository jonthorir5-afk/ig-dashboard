# Follow-Up Notes

## Figure Out Later

- OnlyFans revenue mismatch: dashboard is using OnlyFansAPI tracking-link revenue, which may use a narrower attribution model than the CRM numbers. Ariana's `twitter` / `c45` link is one confirmed example to revisit later. Compare the exact OnlyFansAPI response fields against the CRM's lifetime revenue definition before changing the dashboard logic.
- Instagram sync blocker: Apify is returning `usage_exceeded` for some Instagram follower-count runs. Increase Apify usage / credits / actor access first, then resume testing the Instagram follower sync flow.
- Instagram follow-up: Apify and Netlify credits were increased on 2026-04-02, so the Instagram follower sync flow should be re-tested and stabilized next.
- Meta Instagram auth follow-up: the new Meta-backed Instagram connection flow is scaffolded, but Instagram OAuth is still failing on Instagram's side with `Sorry, this page isn't available` before the callback is reached. Redirect URI appears correct, so the next likely blockers are Meta app/use-case configuration or the requested scope. Resume by testing with `META_INSTAGRAM_SCOPES=instagram_business_basic` and re-checking the Meta Instagram Login setup.
- VPS follow-up: move the new `scraper/` Instagram pipeline onto a small always-on VPS later so the daily RocketAPI run does not depend on a local Mac staying awake. When doing this, also add the scraper `.env`, cron job, and logs directory.

## Instagram Conclusion: RocketAPI works for play counts on NSFW accounts

**Date updated:** 2026-04-06  
**Status:** Working solution confirmed

### What's happening

The Instagram scraper no longer depends on `instagrapi`, burner accounts, session files, or HikerAPI for play counts. The working provider is now RocketAPI using:

- `POST /instagram/user/get_info`
- `POST /instagram/user/get_media`

This flow successfully returns reel/video `play_count` values for our NSFW and age-restricted accounts, and those values are now written into `ig_views_7d` in `snapshots`.

### What was tested

- `instagrapi` returned reels but often exposed `view_count=0` for NSFW accounts
- HikerAPI returned recent reels for some accounts, but `play_count` was still `0`
- SociaVault returned `Profile is restricted` and was not usable for these accounts
- RocketAPI `get_media` returned real media items with non-zero `play_count` values on the same accounts

### Conclusion

RocketAPI via the `get_media` endpoint is the working solution for Instagram play counts on NSFW accounts. The scraper should treat RocketAPI as the active Instagram provider going forward.

### Notes

- Metrics are currently calculated from the 12 most recent posts returned by RocketAPI
- `ig_views_7d` is populated from `play_count` on `media_type == 2` items
- Some individual accounts may still return `0` on specific runs, but the provider/path is now proven to work overall
- `captured_by` for the new Instagram snapshots should be `rocketapi`

### What is NOT possible externally

Reach, impressions, profile visits, and story views are gated behind Instagram's official Graph API and require account-owner authentication. No external scraper can reliably access these for any account.
