# Follow-Up Notes

## Figure Out Later

- OnlyFans revenue mismatch: dashboard is using OnlyFansAPI tracking-link revenue, which may use a narrower attribution model than the CRM numbers. Ariana's `twitter` / `c45` link is one confirmed example to revisit later. Compare the exact OnlyFansAPI response fields against the CRM's lifetime revenue definition before changing the dashboard logic.
- Instagram sync blocker: Apify is returning `usage_exceeded` for some Instagram follower-count runs. Increase Apify usage / credits / actor access first, then resume testing the Instagram follower sync flow.
- Instagram follow-up: Apify and Netlify credits were increased on 2026-04-02, so the Instagram follower sync flow should be re-tested and stabilized next.
- Meta Instagram auth follow-up: the new Meta-backed Instagram connection flow is scaffolded, but Instagram OAuth is still failing on Instagram's side with `Sorry, this page isn't available` before the callback is reached. Redirect URI appears correct, so the next likely blockers are Meta app/use-case configuration or the requested scope. Resume by testing with `META_INSTAGRAM_SCOPES=instagram_business_basic` and re-checking the Meta Instagram Login setup.
- VPS follow-up: move the new `scraper/` Instagram pipeline onto a small always-on VPS later so the daily `instagrapi` run does not depend on a local Mac staying awake. When doing this, also add the burner account `session.json`, `.env`, cron job, logs directory, and ideally a residential proxy.
