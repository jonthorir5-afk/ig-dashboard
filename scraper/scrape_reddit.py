from __future__ import annotations

import logging
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from supabase import Client as SupabaseClient
from supabase import create_client


BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
HEADERS = {"User-Agent": "ig-dashboard/1.0 analytics scraper"}
COOKIES = {"over18": "1", "_options": "%7B%22pref_quarantine_optin%22%3A%20true%7D"}
ACCOUNT_DELAY_SECONDS = 2.0


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("reddit-scraper")


@dataclass
class RedditMetrics:
    karma_total: int
    account_age_days: int
    posts_1d: int
    posts_7d: int
    upvotes_1d: int
    upvotes_7d: int
    avg_upvotes_7d: int
    top_post_upvotes: int
    subreddits_posted_7d: int
    comments_received_1d: int
    comments_received_7d: int
    ban_log: str | None


def env_required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def build_supabase() -> SupabaseClient:
    return create_client(env_required("SUPABASE_URL"), env_required("SUPABASE_SERVICE_KEY"))


def build_http_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(HEADERS)
    session.cookies.update(COOKIES)
    return session


def normalize_handle(handle: str) -> str:
    normalized = handle.strip().strip("/")
    if normalized.startswith("@"):
        normalized = normalized[1:]
    if normalized.lower().startswith("u/"):
        normalized = normalized[2:]
    return normalized


def get_active_reddit_accounts(supabase: SupabaseClient) -> list[dict[str, Any]]:
    response = (
        supabase.table("accounts")
        .select("id,handle")
        .eq("platform", "reddit")
        .eq("status", "Active")
        .order("created_at", desc=False)
        .execute()
    )
    return response.data or []


def patch_account_scraped_at(supabase: SupabaseClient, account_id: str) -> None:
    (
        supabase.table("accounts")
        .update(
            {
                "last_scraped_at": datetime.now(timezone.utc).isoformat(),
                "data_source": "scraper",
            }
        )
        .eq("id", account_id)
        .execute()
    )


def get_snapshot_for_date(supabase: SupabaseClient, account_id: str, snapshot_date: str) -> dict[str, Any] | None:
    response = (
        supabase.table("snapshots")
        .select("id")
        .eq("account_id", account_id)
        .eq("snapshot_date", snapshot_date)
        .limit(1)
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else None


def reddit_get_json(session: requests.Session, url: str, params: dict[str, Any] | None = None) -> tuple[int, dict[str, Any] | None]:
    response = session.get(url, params=params, timeout=30)
    status_code = response.status_code
    if status_code in (403, 404):
        return status_code, None

    response.raise_for_status()
    payload = response.json()
    if isinstance(payload, dict) and payload.get("error") == 404:
        return 404, None
    return status_code, payload


def snapshot_payload(account_id: str, snapshot_date: str, metrics: RedditMetrics) -> dict[str, Any]:
    return {
        "account_id": account_id,
        "snapshot_date": snapshot_date,
        "rd_karma_total": metrics.karma_total,
        "rd_account_age_days": metrics.account_age_days,
        "rd_posts_1d": metrics.posts_1d,
        "rd_posts_7d": metrics.posts_7d,
        "rd_upvotes_1d": metrics.upvotes_1d,
        "rd_upvotes_7d": metrics.upvotes_7d,
        "rd_avg_upvotes_7d": metrics.avg_upvotes_7d,
        "rd_top_post_upvotes": metrics.top_post_upvotes,
        "rd_subreddits_posted_7d": metrics.subreddits_posted_7d,
        "rd_comments_received_1d": metrics.comments_received_1d,
        "rd_comments_received_7d": metrics.comments_received_7d,
        "rd_ban_log": metrics.ban_log,
        "captured_by": "reddit_public_api",
    }


def upsert_snapshot(supabase: SupabaseClient, account_id: str, snapshot_date: str, metrics: RedditMetrics) -> None:
    payload = snapshot_payload(account_id, snapshot_date, metrics)
    existing = get_snapshot_for_date(supabase, account_id, snapshot_date)
    if existing:
        supabase.table("snapshots").update(payload).eq("id", existing["id"]).execute()
    else:
        supabase.table("snapshots").insert(payload).execute()


def zero_metrics(ban_log: str | None = None) -> RedditMetrics:
    return RedditMetrics(
        karma_total=0,
        account_age_days=0,
        posts_1d=0,
        posts_7d=0,
        upvotes_1d=0,
        upvotes_7d=0,
        avg_upvotes_7d=0,
        top_post_upvotes=0,
        subreddits_posted_7d=0,
        comments_received_1d=0,
        comments_received_7d=0,
        ban_log=ban_log,
    )


def scrape_reddit_profile(session: requests.Session, handle: str) -> RedditMetrics | None:
    username = normalize_handle(handle)
    now_utc = datetime.now(timezone.utc)
    cutoff_1d = now_utc - timedelta(days=1)
    cutoff_7d = now_utc - timedelta(days=7)

    about_status, about_payload = reddit_get_json(session, f"https://www.reddit.com/user/{username}/about.json")
    if about_status in (403, 404) or about_payload is None:
        logger.warning("[%s] about.json returned %s", handle, about_status)
        if about_status == 404:
            return zero_metrics("suspended")
        return None

    about_data = about_payload.get("data", {})
    created_utc = float(about_data.get("created_utc") or 0)
    created_at = datetime.fromtimestamp(created_utc, tz=timezone.utc) if created_utc else now_utc
    karma_total = int(about_data.get("link_karma") or 0) + int(about_data.get("comment_karma") or 0)
    ban_log = "suspended" if about_data.get("is_suspended") else None

    submitted_status, submitted_payload = reddit_get_json(
        session,
        f"https://www.reddit.com/user/{username}/submitted.json",
        params={"limit": 100, "sort": "new"},
    )
    if submitted_status in (403, 404) or submitted_payload is None:
        logger.warning("[%s] submitted.json returned %s", handle, submitted_status)
        return None

    submitted_children = submitted_payload.get("data", {}).get("children", [])
    submitted_posts = [child.get("data", {}) for child in submitted_children if isinstance(child, dict)]
    posts_7d = []
    posts_1d = []
    top_post_upvotes = 0
    subreddits_7d: set[str] = set()

    for post in submitted_posts:
        created = post.get("created_utc")
        score = int(post.get("score") or 0)
        subreddit = str(post.get("subreddit") or "")
        top_post_upvotes = max(top_post_upvotes, score)
        if created is None:
            continue

        created_at_post = datetime.fromtimestamp(float(created), tz=timezone.utc)
        if created_at_post >= cutoff_7d:
            posts_7d.append(post)
            if subreddit:
                subreddits_7d.add(subreddit)
        if created_at_post >= cutoff_1d:
            posts_1d.append(post)

    if len(posts_7d) == len(submitted_posts) == 100:
        logger.warning(
            "[%s] All 100 posts fall within the 7-day window — metrics may be incomplete. Pagination needed for accurate 7d metrics.",
            handle,
        )

    comments_status, comments_payload = reddit_get_json(
        session,
        f"https://www.reddit.com/user/{username}/comments.json",
        params={"limit": 100, "sort": "new"},
    )
    if comments_status in (403, 404) or comments_payload is None:
        logger.warning("[%s] comments.json returned %s", handle, comments_status)
        return None

    comment_children = comments_payload.get("data", {}).get("children", [])
    comments_7d = 0
    comments_1d = 0
    for child in comment_children:
        data = child.get("data", {}) if isinstance(child, dict) else {}
        created = data.get("created_utc")
        if created is None:
            continue
        created_at_comment = datetime.fromtimestamp(float(created), tz=timezone.utc)
        if created_at_comment >= cutoff_7d:
            comments_7d += 1
        if created_at_comment >= cutoff_1d:
            comments_1d += 1

    upvotes_7d = sum(int(post.get("score") or 0) for post in posts_7d)
    upvotes_1d = sum(int(post.get("score") or 0) for post in posts_1d)

    return RedditMetrics(
        karma_total=karma_total,
        account_age_days=max(int((now_utc - created_at).total_seconds() // 86400), 0),
        posts_1d=len(posts_1d),
        posts_7d=len(posts_7d),
        upvotes_1d=upvotes_1d,
        upvotes_7d=upvotes_7d,
        avg_upvotes_7d=int(upvotes_7d / len(posts_7d)) if posts_7d else 0,
        top_post_upvotes=top_post_upvotes,
        subreddits_posted_7d=len(subreddits_7d),
        comments_received_1d=comments_1d,
        comments_received_7d=comments_7d,
        ban_log=ban_log,
    )


def process_account(supabase: SupabaseClient, session: requests.Session, account: dict[str, Any], snapshot_date: str) -> None:
    handle = normalize_handle(account["handle"])
    account_id = account["id"]
    patch_account_scraped_at(supabase, account_id)

    metrics = scrape_reddit_profile(session, handle)
    if metrics is None:
        return

    upsert_snapshot(supabase, account_id, snapshot_date, metrics)
    logger.info(
        "[%s] success | karma=%s posts_7d=%s upvotes_7d=%s comments_7d=%s",
        handle,
        metrics.karma_total,
        metrics.posts_7d,
        metrics.upvotes_7d,
        metrics.comments_received_7d,
    )


def main() -> None:
    load_dotenv(ENV_PATH)
    supabase = build_supabase()
    session = build_http_session()
    snapshot_date = datetime.now(timezone.utc).date().isoformat()

    accounts = get_active_reddit_accounts(supabase)
    logger.info("Found %s active Reddit account(s)", len(accounts))

    for index, account in enumerate(accounts, start=1):
        handle = normalize_handle(account["handle"])
        logger.info("Processing %s/%s: u/%s", index, len(accounts), handle)
        try:
            process_account(supabase, session, account, snapshot_date)
        except requests.HTTPError as exc:
            status_code = exc.response.status_code if exc.response is not None else "unknown"
            if status_code in (403, 404):
                logger.warning("[u/%s] reddit returned %s; skipping", handle, status_code)
            else:
                logger.exception("[u/%s] request failed: %s", handle, exc)
        except Exception as exc:  # noqa: BLE001
            logger.exception("[u/%s] unexpected failure: %s", handle, exc)

        if index < len(accounts):
            logger.info("Sleeping %.2f seconds before next account", ACCOUNT_DELAY_SECONDS)
            time.sleep(ACCOUNT_DELAY_SECONDS)

    logger.info("Run complete")


if __name__ == "__main__":
    main()
