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
HIKERAPI_BASE_URL = "https://api.hikerapi.com"


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


def build_hikerapi_session() -> requests.Session:
    api_key = env_required("HIKERAPI_KEY")
    session = requests.Session()
    session.headers.update({
        "x-access-key": api_key,
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


def hikerapi_get(session: requests.Session, path: str, params: dict[str, Any]) -> Any:
    response = session.get(f"{HIKERAPI_BASE_URL}{path}", params=params, timeout=30)
    response.raise_for_status()
    payload = response.json()
    if isinstance(payload, dict) and "result" in payload:
        return payload["result"]
    return payload


def hikerapi_get_optional(session: requests.Session, path: str, params: dict[str, Any]) -> tuple[int, Any]:
    response = session.get(f"{HIKERAPI_BASE_URL}{path}", params=params, timeout=30)
    if response.status_code == 404:
        return 404, None
    response.raise_for_status()
    payload = response.json()
    if isinstance(payload, dict) and "result" in payload:
        return response.status_code, payload["result"]
    return response.status_code, payload


def extract_media_items(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in ("items", "medias", "data", "results"):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
    return []


def fetch_media_payload(session: requests.Session, normalized_handle: str, user_id: str) -> Any:
    attempts = [
        ("/v2/user/medias/chunk", {"user_id": str(user_id), "amount": 12}),
        ("/v1/user/clips/by/user_id", {"user_id": str(user_id), "amount": 12}),
    ]

    for path, params in attempts:
        try:
            status_code, payload = hikerapi_get_optional(session, path, params)
        except Exception as exc:  # noqa: BLE001
            logger.warning("[%s] HikerAPI %s failed: %s", normalized_handle, path, exc)
            continue

        if status_code == 404:
            logger.warning("[%s] HikerAPI %s returned 404", normalized_handle, path)
            continue

        logger.info("[%s] HikerAPI %s raw response: %s", normalized_handle, path, repr(payload)[:800])
        media_items = extract_media_items(payload)
        if media_items:
            return payload

    logger.warning("[%s] HikerAPI media endpoints returned no posts", normalized_handle)
    return []


def scrape_profile(session: requests.Session, handle: str) -> tuple[dict[str, Any], list[ScrapedPost]]:
    normalized_handle = normalize_handle(handle)
    user = hikerapi_get(session, "/v1/user/by/username", {"username": normalized_handle})
    user_id = user.get("user_id") or user.get("pk") or user.get("id")
    if not user_id:
        raise RuntimeError(f"HikerAPI profile response missing user_id for {normalized_handle}")

    medias_payload = fetch_media_payload(session, normalized_handle, str(user_id))
    media_items = extract_media_items(medias_payload)

    posts: list[ScrapedPost] = []
    for media in media_items:
        shortcode = media.get("code")
        if not shortcode:
            continue
        taken_at_raw = media.get("taken_at")
        taken_at = None
        if taken_at_raw:
            try:
                taken_at = datetime.fromtimestamp(int(taken_at_raw), tz=timezone.utc)
            except (TypeError, ValueError, OSError):
                taken_at = None

        posts.append(
            ScrapedPost(
                shortcode=str(shortcode),
                likes=int(media.get("like_count") or 0),
                comments=int(media.get("comment_count") or 0),
                views=int(media.get("play_count") or 0),
                taken_at=taken_at,
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
        "captured_by": "hikerapi",
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
        "captured_by": "hikerapi",
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

    now_utc = datetime.now(timezone.utc)
    cutoff_7d = now_utc - timedelta(days=7)
    recent_posts = [post for post in posts if post.taken_at and post.taken_at >= cutoff_7d]

    followers = int(user.get("follower_count") or 0)
    following = int(user.get("following_count") or 0)
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
            "[%s] success | followers=%s following=%s posts=%s views_7=%s likes_7=%s comments_7=%s",
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
        hikerapi = build_hikerapi_session()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Startup failed: %s", exc)
        return 1

    snapshot_date = datetime.now(timezone.utc).date().isoformat()
    accounts = get_active_instagram_accounts(supabase)
    logger.info("Found %s active Instagram account(s)", len(accounts))

    for index, account in enumerate(accounts, start=1):
        logger.info("Processing %s/%s: %s", index, len(accounts), account["handle"])
        process_account(hikerapi, supabase, account, snapshot_date)

        if index < len(accounts):
            delay_seconds = 1.0
            logger.info("Sleeping %.2f seconds before next account", delay_seconds)
            time.sleep(delay_seconds)

    logger.info("Run complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
