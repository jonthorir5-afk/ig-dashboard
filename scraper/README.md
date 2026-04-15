# Scraper Setup

## Overview
Two scrapers run daily to populate the dashboard:
- scraper/scrape.py — Instagram (via RocketAPI)
- scraper/scrape_reddit.py — Reddit (public JSON API, no credentials needed)

## Requirements
Python 3.10+
pip install -r requirements.txt

## Environment variables
Copy .env.example to .env and fill in:
- SUPABASE_URL — from Supabase project settings
- SUPABASE_SERVICE_KEY — from Supabase project settings
- ROCKETAPI_KEY — from rocketapi.io dashboard

## Running manually
cd scraper
source .venv/bin/activate
python scrape.py        # Instagram
python scrape_reddit.py # Reddit

## Cron job (recommended)
Set up on a VPS or always-on machine:
0 0 * * * cd /path/to/ig-dashboard/scraper && source .venv/bin/activate && python scrape.py >> logs/scrape.log 2>&1
0 1 * * * cd /path/to/ig-dashboard/scraper && source .venv/bin/activate && python scrape_reddit.py >> logs/reddit.log 2>&1

## Data sources
- Instagram: RocketAPI (rocketapi.io) — requires paid credits
- Reddit: Reddit public JSON API — free, no registration needed
- TikTok: [current provider]
- OnlyFans: OnlyFansAPI tracking links
