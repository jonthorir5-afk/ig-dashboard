# Instagram Scraper

This folder contains a standalone Python scraper that replaces the Apify Instagram actor for the dashboard.

It uses:
- RocketAPI for Instagram scraping
- Reddit public JSON endpoints for Reddit scraping
- Supabase service-role access for database writes

## What it writes

The script reads all active Instagram accounts from `public.accounts` and writes:
- one row per account into `public.snapshots`
- up to 10 recent posts per account into `public.posts`

It skips any account that already has a snapshot for today's date.
It also marks each managed Instagram account in `public.accounts` with `data_source = 'scraper'`.

## Files

- `scrape.py` — Instagram scraper entrypoint
- `scrape_reddit.py` — Reddit scraper entrypoint
- `requirements.txt` — pinned Python dependencies
- `.env.example` — environment variable template
- `systemd/*.example` — example unit/timer files for VPS automation

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
- `ROCKETAPI_KEY`

## Run manually

```bash
cd scraper
source .venv/bin/activate
python scrape.py
```

For Reddit:

```bash
cd scraper
source .venv/bin/activate
python scrape_reddit.py
```

## Output behavior

The script logs to stdout with timestamps and will report:
- startup failures
- per-account success
- per-account skips when today's snapshot already exists
- per-account DB write failures

## DigitalOcean VPS setup

Recommended target:

- DigitalOcean Droplet
- Ubuntu 24.04 LTS
- Basic shared CPU plan with 2 GB RAM
- SSH key auth enabled during Droplet creation
- repo deployed to `/opt/ig-dashboard`
- scraper working directory at `/opt/ig-dashboard/scraper`

### First-run setup on the server

SSH in as root:

```bash
ssh root@YOUR_SERVER_IP
```

Install packages:

```bash
sudo apt update
sudo apt install -y git python3 python3-venv python3-pip
```

Create the deploy user:

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
sudo mkdir -p /home/deploy/.ssh
sudo cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
su - deploy
```

Clone the repo and create the Python environment:

```bash
sudo mkdir -p /opt
sudo chown -R "$USER":"$USER" /opt
cd /opt
git clone https://github.com/jonthorir5-afk/ig-dashboard.git
cd /opt/ig-dashboard/scraper
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
mkdir -p logs
cp .env.example .env
```

Production `.env` on the VPS should contain:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `ROCKETAPI_KEY`

No Instagram session, burner account, proxy, or Reddit credentials are needed.

Test both scrapers manually before enabling timers:

```bash
cd /opt/ig-dashboard/scraper
source .venv/bin/activate
python scrape.py
python scrape_reddit.py
```

## systemd timers on the VPS

This repo includes example files in `scraper/systemd/` for:

- `instagram-scraper.service.example`
- `instagram-scraper.timer.example`
- `reddit-scraper.service.example`
- `reddit-scraper.timer.example`

Suggested schedule:

- Instagram daily at `06:00`
- Reddit daily at `06:15`

Install them like this:

```bash
sudo cp /opt/ig-dashboard/scraper/systemd/instagram-scraper.service.example /etc/systemd/system/instagram-scraper.service
sudo cp /opt/ig-dashboard/scraper/systemd/instagram-scraper.timer.example /etc/systemd/system/instagram-scraper.timer
sudo cp /opt/ig-dashboard/scraper/systemd/reddit-scraper.service.example /etc/systemd/system/reddit-scraper.service
sudo cp /opt/ig-dashboard/scraper/systemd/reddit-scraper.timer.example /etc/systemd/system/reddit-scraper.timer
sudo systemctl daemon-reload
sudo systemctl enable --now instagram-scraper.timer
sudo systemctl enable --now reddit-scraper.timer
```

Check status:

```bash
systemctl list-timers --all | grep scraper
systemctl status instagram-scraper.timer
systemctl status reddit-scraper.timer
```

Run manually:

```bash
sudo systemctl start instagram-scraper.service
sudo systemctl start reddit-scraper.service
```

Inspect logs:

```bash
journalctl -u instagram-scraper.service -n 100 --no-pager
journalctl -u reddit-scraper.service -n 100 --no-pager
```

## Operational notes

- Use the Supabase **service role** key, not the anon key.
- RocketAPI handles the Instagram scraping layer, so no local sessions, burner accounts, or proxy setup are needed here.
- Reddit scraping uses public JSON endpoints plus the `over18` cookie opt-in and does not require Reddit credentials.
- The Instagram scraper sleeps 1 second between accounts.
- The Reddit scraper sleeps 2 seconds between accounts.
- The Reddit scraper will warn that `accounts.last_scraped_at` is missing in Supabase and fall back to updating only `data_source`. This is expected with the current schema and does not block snapshot writes.
- If RocketAPI or Reddit has a transient failure, rerun the corresponding `systemctl start ...service` command and then inspect the journal logs.
- To update deployed code later:

```bash
cd /opt/ig-dashboard
git pull origin main
cd scraper
source .venv/bin/activate
pip install -r requirements.txt
sudo systemctl daemon-reload
```
