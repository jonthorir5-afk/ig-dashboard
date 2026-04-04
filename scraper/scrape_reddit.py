from __future__ import annotations

import logging
import os
import random
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
USER_AGENT = "ig-dashboard-scraper/1.0"
REQUEST_DELAY_SECONDS = 2.0


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("reddit-scraper")


@dataclass
class RedditSubmission:
    created_at: datetime
    score: int
    subreddit: str


@dataclass
class RedditComment:
    created_at: datetime


@dataclass
class RedditProfileMetrics:
    karma_total: int
    account_age_days: int
    posts_1d: int
    posts_7d: int
    upvotes_1d: int
    upvotes_7d: int
    avg_upvotes_1d: int
    avg_upvotes_7d: int
    top_post_upvotes: int
    subreddits_posted_7d: int
    comments_received_1d: int
    comments_received_7d: int
    ban_log: str | None


class RedditUserNotFoundError(RuntimeError):
    pass


def env_required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def build_supabase() -> SupabaseClient:
    url = env_required("SUPABASE_URL")
    key = env_required("SUPABASE_SERVICE_KEY")
    return create_client(url, key)


def build_http_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    return session


def normalize_reddit_handle(handle: str) -> str:
    normalized = handle.strip().strip("/")
    if normalized.startswith("@"):
        normalized = normalized[1:]
    if normalized.lower().startswith("u/"):
        normalized = normalized[2:]
    return normalized


def get_active_reddit_accounts(supabase: SupabaseClient) -> list[dict[str, Any]]:
    response = (
        supabase.table("accounts")
        .select("id, handle, platform, data_source, status")
        .eq("platform", "reddit")
        .eq("status", "Active")
        .order("created_at", desc=False)
        .execute()
    )
    return response.data or []


def get_snapshot_for_date(supabase: SupabaseClient, account_id: str, snapshot_date: str) -> dict[str, Any] | None:
    response = (
        supabase.table("snapshots")
        .select("id")
        .eq("account_id", account_id)
        .eq("snapshot_date", snapshot_date)
        .limit(1)
        .execute()
    )
    data = response.data or []
    return data[0] if data else None


def update_account_source(supabase: SupabaseClient, account_id: str) -> None:
    (
        supabase.table("accounts")
        .update({"data_source": "scraper"})
        .eq("id", account_id)
        .execute()
    )


class RedditJsonClient:
    def __init__(self, session: requests.Session) -> None:
        self.session = session
        self._last_request_started_at: float | None = None

    def get_json(self, url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        if self._last_request_started_at is not None:
            elapsed = time.monotonic() - self._last_request_started_at
            remaining = REQUEST_DELAY_SECONDS - elapsed
            if remaining > 0:
                time.sleep(remaining)

        self._last_request_started_at = time.monotonic()
        response = self.session.get(url, params=params, timeout=30)

        if response.status_code == 404:
            raise RedditUserNotFoundError("reddit account not found or suspended")
        if response.status_code != 200:
            raise RuntimeError(f"Reddit returned HTTP {response.status_code} for {response.url}")

        payload = response.json()
        if payload.get("error") == 404:
            raise RedditUserNotFoundError("reddit account not found or suspended")
        return payload


def iter_recent_submissions(client: RedditJsonClient, username: str, cutoff_7d: datetime) -> list[RedditSubmission]:
    submissions: list[RedditSubmission] = []
    after: str | None = None

    while True:
        payload = client.get_json(
            f"https://www.reddit.com/user/{username}/submitted.json",
            params={"limit": 100, "sort": "new", "after": after},
        )
        children = payload.get("data", {}).get("children", [])
        if not children:
            break

        hit_cutoff = False
        for child in children:
            data = child.get("data", {})
            created_utc = data.get("created_utc")
            if created_utc is None:
                continue

            created_at = datetime.fromtimestamp(float(created_utc), tz=timezone.utc)
            if created_at < cutoff_7d:
                hit_cutoff = True
                break

            submissions.append(
                RedditSubmission(
                    created_at=created_at,
                    score=int(data.get("score") or 0),
                    subreddit=str(data.get("subreddit") or ""),
                )
            )

        if hit_cutoff:
            break

        after = payload.get("data", {}).get("after")
        if not after:
            break

    return submissions


def iter_recent_comments(client: RedditJsonClient, username: str, cutoff_7d: datetime) -> list[RedditComment]:
    comments: list[RedditComment] = []
    after: str | None = None

    while True:
        payload = client.get_json(
            f"https://www.reddit.com/user/{username}/comments.json",
            params={"limit": 100, "sort": "new", "after": after},
        )
        children = payload.get("data", {}).get("children", [])
        if not children:
            break

        hit_cutoff = False
        for child in children:
            data = child.get("data", {})
            created_utc = data.get("created_utc")
            if created_utc is None:
                continue

            created_at = datetime.fromtimestamp(float(created_utc), tz=timezone.utc)
            if created_at < cutoff_7d:
                hit_cutoff = True
                break

            comments.append(RedditComment(created_at=created_at))

        if hit_cutoff:
            break

        after = payload.get("data", {}).get("after")
        if not after:
            break

    return comments


def zero_metrics(ban_log: str | None = None) -> RedditProfileMetrics:
    return RedditProfileMetrics(
        karma_total=0,
        account_age_days=0,
        posts_1d=0,
        posts_7d=0,
        upvotes_1d=0,
        upvotes_7d=0,
        avg_upvotes_1d=0,
        avg_upvotes_7d=0,
        top_post_upvotes=0,
        subreddits_posted_7d=0,
        comments_received_1d=0,
        comments_received_7d=0,
        ban_log=ban_log,
    )


def scrape_reddit_profile(client: RedditJsonClient, handle: str) -> RedditProfileMetrics:
    username = normalize_reddit_handle(handle)
    about = client.get_json(f"https://www.reddit.com/user/{username}/about.json")
    about_data = about.get("data", {})

    now_utc = datetime.now(timezone.utc)
    cutoff_1d = now_utc - timedelta(days=1)
    cutoff_7d = now_utc - timedelta(days=7)

    created_utc = float(about_data.get("created_utc") or 0)
    created_at = datetime.fromtimestamp(created_utc, tz=timezone.utc) if created_utc else now_utc

    submissions = iter_recent_submissions(client, username, cutoff_7d)
    comments = iter_recent_comments(client, username, cutoff_7d)

    submissions_1d = [item for item in submissions if item.created_at >= cutoff_1d]
    comments_1d = [item for item in comments if item.created_at >= cutoff_1d]

    rd_posts_1d = len(submissions_1d)
    rd_posts_7d = len(submissions)
    rd_upvotes_1d = sum(item.score for item in submissions_1d)
    rd_upvotes_7d = sum(item.score for item in submissions)
    rd_avg_upvotes_1d = int(rd_upvotes_1d / rd_posts_1d) if rd_posts_1d > 0 else 0
    rd_avg_upvotes_7d = int(rd_upvotes_7d / rd_posts_7d) if rd_posts_7d > 0 else 0
    rd_top_post_upvotes = max((item.score for item in submissions), default=0)
    rd_subreddits_posted_7d = len({item.subreddit for item in submissions if item.subreddit})

    return RedditProfileMetrics(
        karma_total=int(about_data.get("link_karma") or 0) + int(about_data.get("comment_karma") or 0),
        account_age_days=max(int((now_utc - created_at).total_seconds() / 86400), 0),
        posts_1d=rd_posts_1d,
        posts_7d=rd_posts_7d,
        upvotes_1d=rd_upvotes_1d,
        upvotes_7d=rd_upvotes_7d,
        avg_upvotes_1d=rd_avg_upvotes_1d,
        avg_upvotes_7d=rd_avg_upvotes_7d,
        top_post_upvotes=rd_top_post_upvotes,
        subreddits_posted_7d=rd_subreddits_posted_7d,
        comments_received_1d=len(comments_1d),
        comments_received_7d=len(comments),
        ban_log=None,
    )


def snapshot_payload(account_id: str, snapshot_date: str, metrics: RedditProfileMetrics) -> dict[str, Any]:
    return {
        "account_id": account_id,
        "snapshot_date": snapshot_date,
        "rd_karma_total": metrics.karma_total,
        "rd_account_age_days": metrics.account_age_days,
        "rd_posts_1d": metrics.posts_1d,
        "rd_posts_7d": metrics.posts_7d,
        "rd_upvotes_1d": metrics.upvotes_1d,
        "rd_upvotes_7d": metrics.upvotes_7d,
        "rd_avg_upvotes_1d": metrics.avg_upvotes_1d,
        "rd_avg_upvotes_7d": metrics.avg_upvotes_7d,
        "rd_top_post_upvotes": metrics.top_post_upvotes,
        "rd_subreddits_posted_7d": metrics.subreddits_posted_7d,
        "rd_comments_received_1d": metrics.comments_received_1d,
        "rd_comments_received_7d": metrics.comments_received_7d,
        "rd_ban_log": metrics.ban_log,
        "captured_by": "reddit-json",
    }


def insert_snapshot(
    supabase: SupabaseClient,
    account_id: str,
    snapshot_date: str,
    metrics: RedditProfileMetrics,
) -> str:
    response = supabase.table("snapshots").insert(snapshot_payload(account_id, snapshot_date, metrics)).execute()
    if not response.data:
        raise RuntimeError(f"Snapshot insert returned no rows for account_id={account_id}")
    return response.data[0]["id"]


def update_snapshot(supabase: SupabaseClient, snapshot_id: str, account_id: str, snapshot_date: str, metrics: RedditProfileMetrics) -> None:
    supabase.table("snapshots").update(snapshot_payload(account_id, snapshot_date, metrics)).eq("id", snapshot_id).execute()


def process_account(client: RedditJsonClient, supabase: SupabaseClient, account: dict[str, Any], snapshot_date: str) -> None:
    account_id = account["id"]
    handle = account["handle"]

    try:
        update_account_source(supabase, account_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("[%s] failed to mark account data_source as scraper: %s", handle, exc)

    existing_snapshot = get_snapshot_for_date(supabase, account_id, snapshot_date)
    if existing_snapshot:
        logger.info("[%s] snapshot already exists for %s; refreshing snapshot fields", handle, snapshot_date)

    try:
        metrics = scrape_reddit_profile(client, handle)
    except RedditUserNotFoundError:
        logger.warning("[%s] reddit account not found or suspended; marking snapshot accordingly", handle)
        metrics = zero_metrics(ban_log="suspended")
    except Exception as exc:  # noqa: BLE001
        logger.exception("[%s] scrape failed: %s", handle, exc)
        return

    try:
        if existing_snapshot:
            update_snapshot(supabase, existing_snapshot["id"], account_id, snapshot_date, metrics)
        else:
            insert_snapshot(supabase, account_id, snapshot_date, metrics)
        logger.info(
            "[%s] success | karma=%s posts_1d=%s posts_7d=%s upvotes_7d=%s comments_7d=%s ban_log=%s",
            handle,
            metrics.karma_total,
            metrics.posts_1d,
            metrics.posts_7d,
            metrics.upvotes_7d,
            metrics.comments_received_7d,
            metrics.ban_log,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("[%s] database write failed: %s", handle, exc)


def main() -> int:
    load_dotenv(ENV_PATH if ENV_PATH.exists() else None)

    try:
        supabase = build_supabase()
        reddit = RedditJsonClient(build_http_session())
    except Exception as exc:  # noqa: BLE001
        logger.exception("Startup failed: %s", exc)
        return 1

    snapshot_date = datetime.now(timezone.utc).date().isoformat()
    accounts = get_active_reddit_accounts(supabase)
    logger.info("Found %s active Reddit account(s)", len(accounts))

    for index, account in enumerate(accounts, start=1):
        logger.info("Processing %s/%s: %s", index, len(accounts), account["handle"])
        process_account(reddit, supabase, account, snapshot_date)

        if index < len(accounts):
            delay_seconds = random.uniform(2, 4)
            logger.info("Sleeping %.2f seconds before next account", delay_seconds)
            time.sleep(delay_seconds)

    logger.info("Run complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
