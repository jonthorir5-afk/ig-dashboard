# Instagram Scraper

This folder contains a standalone Python scraper that replaces the Apify Instagram actor for the dashboard.

It uses:
- `instagrapi` for authenticated Instagram scraping
- Supabase service-role access for database writes
- a local session file so the scraper can reuse an Instagram login between runs

## What it writes

The script reads all active Instagram accounts from `public.accounts` and writes:
- one row per account into `public.snapshots`
- up to 10 recent posts per account into `public.posts`

It skips any account that already has a snapshot for today's date.
It also marks each managed Instagram account in `public.accounts` with `data_source = 'scraper'`.

## Files

- `scrape.py` — main scraper entrypoint
- `create_session.py` — first-time login / session validation helper
- `test_connection.py` — dry-run test against Supabase + one Instagram account
- `requirements.txt` — pinned Python dependencies
- `.env.example` — environment variable template

## Setup

0. Make sure you're using **Python 3.10 or newer**.
The macOS system Python is often 3.9, which is too old for `instagrapi==2.3.0`.

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
- `IG_SESSION_FILE`
- `IG_USERNAME`
- `IG_PASSWORD`
- `PROXY_URL` (optional, leave blank to skip proxy usage)

## First-time login / session creation

The easiest way to create or refresh the saved Instagram session is:

```bash
cd scraper
source .venv/bin/activate
python create_session.py
```

If `IG_SESSION_FILE` does not exist, the helper will:
- log in with `IG_USERNAME` and `IG_PASSWORD`
- save the session JSON to `IG_SESSION_FILE`

On later runs, it will load the saved session instead of logging in again.

Example session file setting:

```env
IG_SESSION_FILE=./session.json
```

## Run manually

```bash
cd scraper
source .venv/bin/activate
python scrape.py
```

## Dry-run test before writing data

Before running the full scraper, validate the setup against Supabase and one Instagram target:

```bash
cd scraper
source .venv/bin/activate
python test_connection.py
```

To test a specific account:

```bash
python test_connection.py --handle arianaangelsxo
```

This will:
- load the session
- read active Instagram rows from Supabase
- scrape one target profile
- print the follower/post metrics it would use
- perform **no** database writes

## Output behavior

The script logs to stdout with timestamps and will report:
- startup failures
- per-account success
- per-account skips when today's snapshot already exists
- per-account auth/challenge failures
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
- A residential proxy is strongly recommended for Instagram scraping.
- The script adds a random 2–5 second delay between accounts.
- If Instagram raises `LoginRequired` or `ChallengeRequired`, the script logs the error and skips the affected account instead of crashing the whole run.
