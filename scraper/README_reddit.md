# Reddit Scraper

This folder also contains a standalone Reddit scraper that uses Reddit's public JSON endpoints and writes directly to Supabase.

It does not use PRAW and does not require Reddit API credentials.

## What it writes

The script reads all active Reddit accounts from `public.accounts` and writes one row per account into `public.snapshots`.

It populates Reddit-specific snapshot fields such as:
- total karma
- account age in days
- posts in the last 1 day / 7 days
- upvotes in the last 1 day / 7 days
- average upvotes per post in the last 1 day / 7 days
- top-post upvotes in the last 7 days
- unique subreddits posted to in the last 7 days
- comment activity in the last 1 day / 7 days
- suspension marker via `rd_ban_log`

It also marks each managed Reddit account in `public.accounts` with `data_source = 'scraper'`.

## Data source

The scraper uses these public endpoints:
- `https://www.reddit.com/user/{username}/about.json`
- `https://www.reddit.com/user/{username}/submitted.json?limit=100&sort=new`
- `https://www.reddit.com/user/{username}/comments.json?limit=100&sort=new`

Every request uses:

```python
headers = {"User-Agent": "ig-dashboard-scraper/1.0"}
```

The script also rate-limits itself and sleeps between accounts.

## Setup

The Reddit scraper uses the same `.env` file as the Instagram scraper.

Required values:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

No Reddit credentials are needed.

Install dependencies:

```bash
cd scraper
source .venv/bin/activate
pip install -r requirements.txt
```

## Run manually

```bash
cd scraper
source .venv/bin/activate
python scrape_reddit.py
```

## Daily cron job

If you want the Reddit scraper to run daily alongside the Instagram scraper, add a second cron job.

Example:

```cron
15 0 * * * cd /path/to/ig-dashboard/scraper && /path/to/ig-dashboard/scraper/.venv/bin/python scrape_reddit.py >> /path/to/ig-dashboard/scraper/logs/reddit-scrape.log 2>&1
```

This example runs the Reddit scraper every day at `00:15`, slightly after the Instagram scraper.

## Operational notes

- Suspended or missing Reddit users are handled gracefully and marked with `rd_ban_log = 'suspended'`
- The scraper updates today's snapshot if it already exists
- Reddit does not expose private metrics like link clicks or total views publicly, so those are intentionally not populated
