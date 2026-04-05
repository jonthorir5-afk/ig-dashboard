# Instagram Scraper

This folder contains a standalone Python scraper that replaces the Apify Instagram actor for the dashboard.

It uses:
- HikerAPI for Instagram scraping
- Supabase service-role access for database writes

## What it writes

The script reads all active Instagram accounts from `public.accounts` and writes:
- one row per account into `public.snapshots`
- up to 10 recent posts per account into `public.posts`

It skips any account that already has a snapshot for today's date.
It also marks each managed Instagram account in `public.accounts` with `data_source = 'scraper'`.

## Files

- `scrape.py` — main scraper entrypoint
- `requirements.txt` — pinned Python dependencies
- `.env.example` — environment variable template

## Setup

0. Make sure you're using **Python 3.10 or newer**.

Check your version:

```bash
python3 --version
```

If it shows `3.9.x`, install a newer Python first, then create the virtual environment with that version.

1. Create a Python virtual environment:

```bash
cd scraper
python3.11 -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Create your `.env` file:

```bash
cp .env.example .env
```

4. Fill in `.env`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `HIKERAPI_KEY`

## Run manually

```bash
cd scraper
source .venv/bin/activate
python scrape.py
```

## Output behavior

The script logs to stdout with timestamps and will report:
- startup failures
- per-account success
- per-account skips when today's snapshot already exists
- per-account DB write failures

## Hourly cron job on a Linux VPS

Open your crontab:

```bash
crontab -e
```

Add a job like this:

```cron
0 * * * * cd /path/to/ig-dashboard/scraper && /path/to/ig-dashboard/scraper/.venv/bin/python scrape.py >> /var/log/ig-scraper.log 2>&1
```

This runs the scraper at the top of every hour and appends logs to `/var/log/ig-scraper.log`.

## Operational notes

- Use the Supabase **service role** key, not the anon key.
- HikerAPI handles the Instagram scraping layer, so no local sessions, burner accounts, or proxy setup are needed here.
- The script sleeps 1 second between accounts.
