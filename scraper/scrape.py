from __future__ import annotations

import logging
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from supabase import Client as SupabaseClient
from supabase import create_client


BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
ROCKETAPI_BASE_URL = "https://v1.rocketapi.io"


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("instagram-scraper")


@dataclass
class ScrapedPost:
    shortcode: str
    likes: int
    comments: int
    views: int
    taken_at: datetime | None
    media_type: int


def env_required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def build_supabase() -> SupabaseClient:
    url = env_required("SUPABASE_URL")
    key = env_required("SUPABASE_SERVICE_KEY")
    return create_client(url, key)


def build_rocketapi_session() -> requests.Session:
    api_key = env_required("ROCKETAPI_KEY")
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Token {api_key}",
        "Content-Type": "application/json",
        "accept": "application/json",
    })
    return session


def get_active_instagram_accounts(supabase: SupabaseClient) -> list[dict[str, Any]]:
    response = (
        supabase.table("accounts")
        .select("id, handle, platform, data_source, status")
        .eq("platform", "instagram")
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


def get_post_count_for_snapshot(supabase: SupabaseClient, snapshot_id: str) -> int:
    response = (
        supabase.table("posts")
        .select("id", count="exact")
        .eq("snapshot_id", snapshot_id)
        .limit(1)
        .execute()
    )
    return int(response.count or 0)


def update_account_source(supabase: SupabaseClient, account_id: str) -> None:
    (
        supabase.table("accounts")
        .update({"data_source": "scraper"})
        .eq("id", account_id)
        .execute()
    )


def normalize_handle(handle: str) -> str:
    return handle.strip().lstrip("@").rstrip("/")


def dig(data: Any, *path: str) -> Any:
    current = data
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def rocketapi_post(session: requests.Session, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    response = session.post(f"{ROCKETAPI_BASE_URL}{path}", json=payload, timeout=30)
    response.raise_for_status()
    return response.json()


def extract_media_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    items = (
        dig(payload, "data", "items")
        or dig(payload, "items")
        or dig(payload, "response", "body", "items")
        or dig(payload, "response", "body", "data", "items")
        or []
    )
    if isinstance(items, dict):
        return [item for item in items.values() if isinstance(item, dict)]
    if isinstance(items, list):
        return [item for item in items if isinstance(item, dict)]
    return []


def parse_taken_at(value: Any) -> datetime | None:
    if value is None:
        return None
    try:
        if isinstance(value, str):
            if value.endswith("Z"):
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            return datetime.fromisoformat(value)
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


def scrape_profile(session: requests.Session, handle: str) -> tuple[dict[str, Any], list[ScrapedPost]]:
    normalized_handle = normalize_handle(handle)

    info_json = rocketapi_post(session, "/instagram/user/get_info", {"username": normalized_handle})
    user = (
        dig(info_json, "data", "user")
        or dig(info_json, "response", "body", "data", "user")
        or {}
    )
    user_id = user.get("pk") or user.get("id")
    if not user_id:
        raise RuntimeError(f"RocketAPI get_info response missing user id for {normalized_handle}")

    media_json = rocketapi_post(session, "/instagram/user/get_media", {"id": str(user_id)})
    media_items = extract_media_items(media_json)

    posts: list[ScrapedPost] = []
    for media in media_items[:12]:
        shortcode = media.get("code") or media.get("shortcode")
        if not shortcode:
            continue

        posts.append(
            ScrapedPost(
                shortcode=str(shortcode),
                likes=int(media.get("like_count") or 0),
                comments=int(media.get("comment_count") or 0),
                views=int(media.get("play_count") or 0),
                taken_at=parse_taken_at(media.get("taken_at")),
                media_type=int(media.get("media_type") or 0),
            )
        )

    return user, posts


def insert_snapshot(
    supabase: SupabaseClient,
    account_id: str,
    snapshot_date: str,
    followers: int,
    following: int,
    ig_views_7d: int,
    ig_likes_7d: int,
    ig_comments_7d: int,
) -> str:
    engagement_rate = round(((ig_likes_7d + ig_comments_7d) / followers) * 100, 2) if followers > 0 else 0.0

    payload = {
        "account_id": account_id,
        "snapshot_date": snapshot_date,
        "followers": followers,
        "following": following,
        "captured_by": "rocketapi",
        "ig_views_7d": ig_views_7d,
        "ig_likes_7d": ig_likes_7d,
        "ig_comments_7d": ig_comments_7d,
        "engagement_rate_weekly": engagement_rate,
    }
    response = supabase.table("snapshots").insert(payload).execute()
    if not response.data:
        raise RuntimeError(f"Snapshot insert returned no rows for account_id={account_id}")
    return response.data[0]["id"]


def update_snapshot(
    supabase: SupabaseClient,
    snapshot_id: str,
    followers: int,
    following: int,
    ig_views_7d: int,
    ig_likes_7d: int,
    ig_comments_7d: int,
) -> None:
    engagement_rate = round(((ig_likes_7d + ig_comments_7d) / followers) * 100, 2) if followers > 0 else 0.0

    payload = {
        "followers": followers,
        "following": following,
        "captured_by": "rocketapi",
        "ig_views_7d": ig_views_7d,
        "ig_likes_7d": ig_likes_7d,
        "ig_comments_7d": ig_comments_7d,
        "engagement_rate_weekly": engagement_rate,
    }
    supabase.table("snapshots").update(payload).eq("id", snapshot_id).execute()


def insert_posts(
    supabase: SupabaseClient,
    account_id: str,
    snapshot_id: str,
    posts: list[ScrapedPost],
    platform: str = "instagram",
) -> None:
    if not posts:
        return

    payload = []
    for index, post in enumerate(posts, start=1):
        payload.append(
            {
                "account_id": account_id,
                "snapshot_id": snapshot_id,
                "platform": platform,
                "post_index": index,
                "post_url": f"https://www.instagram.com/p/{post.shortcode}/",
                "views": post.views,
                "likes": post.likes,
                "comments": post.comments,
            }
        )
    supabase.table("posts").insert(payload).execute()


def process_account(session: requests.Session, supabase: SupabaseClient, account: dict[str, Any], snapshot_date: str) -> None:
    account_id = account["id"]
    handle = account["handle"]

    try:
        update_account_source(supabase, account_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("[%s] failed to mark account data_source as scraper: %s", handle, exc)

    existing_snapshot = get_snapshot_for_date(supabase, account_id, snapshot_date)
    post_count = 0
    if existing_snapshot:
        post_count = get_post_count_for_snapshot(supabase, existing_snapshot["id"])
        logger.info(
            "[%s] snapshot already exists for %s; refreshing snapshot fields%s",
            handle,
            snapshot_date,
            " and backfilling posts" if post_count == 0 else "",
        )

    try:
        user, posts = scrape_profile(session, handle)
    except Exception as exc:  # noqa: BLE001
        logger.exception("[%s] scrape failed: %s", handle, exc)
        return

    recent_posts = posts[:12]
    followers = int(user.get("edge_followed_by", {}).get("count") or user.get("follower_count") or 0)
    following = int(user.get("edge_follow", {}).get("count") or user.get("following_count") or 0)
    ig_views_7d = sum(post.views for post in recent_posts if post.media_type == 2)
    ig_likes_7d = sum(post.likes for post in recent_posts)
    ig_comments_7d = sum(post.comments for post in recent_posts)

    try:
        if existing_snapshot:
            snapshot_id = existing_snapshot["id"]
            update_snapshot(
                supabase=supabase,
                snapshot_id=snapshot_id,
                followers=followers,
                following=following,
                ig_views_7d=ig_views_7d,
                ig_likes_7d=ig_likes_7d,
                ig_comments_7d=ig_comments_7d,
            )
        else:
            snapshot_id = insert_snapshot(
                supabase=supabase,
                account_id=account_id,
                snapshot_date=snapshot_date,
                followers=followers,
                following=following,
                ig_views_7d=ig_views_7d,
                ig_likes_7d=ig_likes_7d,
                ig_comments_7d=ig_comments_7d,
            )
        if post_count == 0:
            insert_posts(supabase, account_id, snapshot_id, posts, account.get("platform", "instagram"))
        logger.info(
            "[%s] success | followers=%s following=%s posts=%s views_12=%s likes_12=%s comments_12=%s",
            handle,
            followers,
            following,
            len(posts),
            ig_views_7d,
            ig_likes_7d,
            ig_comments_7d,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("[%s] database write failed: %s", handle, exc)


def main() -> int:
    load_dotenv(ENV_PATH if ENV_PATH.exists() else None)

    try:
        supabase = build_supabase()
        rocketapi = build_rocketapi_session()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Startup failed: %s", exc)
        return 1

    snapshot_date = datetime.now(timezone.utc).date().isoformat()
    accounts = get_active_instagram_accounts(supabase)
    logger.info("Found %s active Instagram account(s)", len(accounts))

    for index, account in enumerate(accounts, start=1):
        logger.info("Processing %s/%s: %s", index, len(accounts), account["handle"])
        process_account(rocketapi, supabase, account, snapshot_date)

        if index < len(accounts):
            delay_seconds = 1.0
            logger.info("Sleeping %.2f seconds before next account", delay_seconds)
            time.sleep(delay_seconds)

    logger.info("Run complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
