from __future__ import annotations

import logging
import os
import random
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from instagrapi import Client
from instagrapi.exceptions import ChallengeRequired, LoginRequired, UserNotFound
from supabase import Client as SupabaseClient
from supabase import create_client


BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"


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


def env_required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
      raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def resolve_path(raw_path: str) -> Path:
    path = Path(raw_path).expanduser()
    if not path.is_absolute():
        path = (BASE_DIR / path).resolve()
    return path


def build_supabase() -> SupabaseClient:
    url = env_required("SUPABASE_URL")
    key = env_required("SUPABASE_SERVICE_KEY")
    return create_client(url, key)


def build_instagram_client() -> Client:
    session_file = resolve_path(env_required("IG_SESSION_FILE"))
    proxy_url = os.getenv("PROXY_URL", "").strip()
    username = os.getenv("IG_USERNAME", "").strip()
    password = os.getenv("IG_PASSWORD", "").strip()

    client = Client()
    client.delay_range = [1, 3]

    if proxy_url:
        client.set_proxy(proxy_url)
        logger.info("Instagram proxy enabled")

    if session_file.exists():
        logger.info("Loading Instagram session from %s", session_file)
        settings = client.load_settings(str(session_file))
        if settings:
            client.set_settings(settings)
    else:
        if not username or not password:
            raise RuntimeError(
                "IG_SESSION_FILE does not exist. Provide IG_USERNAME and IG_PASSWORD for first-time login."
            )
        logger.info("No session file found. Performing first-time Instagram login for %s", username)
        client.login(username, password)
        session_file.parent.mkdir(parents=True, exist_ok=True)
        client.dump_settings(str(session_file))
        logger.info("Saved Instagram session to %s", session_file)

    return client


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


def snapshot_exists(supabase: SupabaseClient, account_id: str, snapshot_date: str) -> bool:
    response = (
        supabase.table("snapshots")
        .select("id")
        .eq("account_id", account_id)
        .eq("snapshot_date", snapshot_date)
        .limit(1)
        .execute()
    )
    return bool(response.data)


def update_account_source(supabase: SupabaseClient, account_id: str) -> None:
    (
        supabase.table("accounts")
        .update({"data_source": "scraper"})
        .eq("id", account_id)
        .execute()
    )


def extract_view_count(media: Any) -> int:
    for attr in ("view_count", "play_count", "video_view_count"):
        value = getattr(media, attr, None)
        if value is not None:
            try:
                return int(value)
            except (TypeError, ValueError):
                return 0
    return 0


def scrape_profile(client: Client, handle: str) -> tuple[Any, list[ScrapedPost]]:
    normalized_handle = handle.strip().lstrip("@").rstrip("/")
    user = client.user_info_by_username(normalized_handle)
    medias = client.user_medias(user.pk, amount=10)

    posts: list[ScrapedPost] = []
    for media in medias:
        shortcode = getattr(media, "code", None) or getattr(media, "shortcode", None)
        if not shortcode:
            continue
        posts.append(
            ScrapedPost(
                shortcode=str(shortcode),
                likes=int(getattr(media, "like_count", 0) or 0),
                comments=int(getattr(media, "comment_count", 0) or 0),
                views=extract_view_count(media),
                taken_at=getattr(media, "taken_at", None),
            )
        )
    return user, posts


def insert_snapshot(
    supabase: SupabaseClient,
    account_id: str,
    snapshot_date: str,
    followers: int,
    following: int,
    ig_likes_7d: int,
    ig_comments_7d: int,
) -> str:
    engagement_rate = round(((ig_likes_7d + ig_comments_7d) / followers) * 100, 2) if followers > 0 else 0.0

    payload = {
        "account_id": account_id,
        "snapshot_date": snapshot_date,
        "followers": followers,
        "following": following,
        "captured_by": "instagrapi",
        "ig_likes_7d": ig_likes_7d,
        "ig_comments_7d": ig_comments_7d,
        "engagement_rate_weekly": engagement_rate,
    }
    response = supabase.table("snapshots").insert(payload).execute()
    if not response.data:
        raise RuntimeError(f"Snapshot insert returned no rows for account_id={account_id}")
    return response.data[0]["id"]


def insert_posts(supabase: SupabaseClient, account_id: str, snapshot_id: str, posts: list[ScrapedPost]) -> None:
    if not posts:
        return

    payload = []
    for index, post in enumerate(posts, start=1):
        payload.append(
            {
                "account_id": account_id,
                "snapshot_id": snapshot_id,
                "post_index": index,
                "post_url": f"https://www.instagram.com/p/{post.shortcode}/",
                "views": post.views,
                "likes": post.likes,
                "comments": post.comments,
            }
        )
    supabase.table("posts").insert(payload).execute()


def process_account(client: Client, supabase: SupabaseClient, account: dict[str, Any], snapshot_date: str) -> None:
    account_id = account["id"]
    handle = account["handle"]

    try:
        update_account_source(supabase, account_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("[%s] failed to mark account data_source as scraper: %s", handle, exc)

    if snapshot_exists(supabase, account_id, snapshot_date):
        logger.info("[%s] skipping, snapshot already exists for %s", handle, snapshot_date)
        return

    try:
        user, posts = scrape_profile(client, handle)
    except (LoginRequired, ChallengeRequired) as exc:
        logger.error("[%s] auth/session issue: %s", handle, exc)
        return
    except UserNotFound as exc:
        logger.error("[%s] user not found: %s", handle, exc)
        return
    except Exception as exc:  # noqa: BLE001
        logger.exception("[%s] scrape failed: %s", handle, exc)
        return

    recent_posts = posts[:7]
    followers = int(getattr(user, "follower_count", 0) or 0)
    following = int(getattr(user, "following_count", 0) or 0)
    ig_likes_7d = sum(post.likes for post in recent_posts)
    ig_comments_7d = sum(post.comments for post in recent_posts)

    try:
        snapshot_id = insert_snapshot(
            supabase=supabase,
            account_id=account_id,
            snapshot_date=snapshot_date,
            followers=followers,
            following=following,
            ig_likes_7d=ig_likes_7d,
            ig_comments_7d=ig_comments_7d,
        )
        insert_posts(supabase, account_id, snapshot_id, posts)
        logger.info(
            "[%s] success | followers=%s following=%s posts=%s likes_7=%s comments_7=%s",
            handle,
            followers,
            following,
            len(posts),
            ig_likes_7d,
            ig_comments_7d,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("[%s] database write failed: %s", handle, exc)


def main() -> int:
    load_dotenv(ENV_PATH if ENV_PATH.exists() else None)

    try:
        supabase = build_supabase()
        instagram = build_instagram_client()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Startup failed: %s", exc)
        return 1

    snapshot_date = datetime.now(timezone.utc).date().isoformat()
    accounts = get_active_instagram_accounts(supabase)
    logger.info("Found %s active Instagram account(s)", len(accounts))

    for index, account in enumerate(accounts, start=1):
        logger.info("Processing %s/%s: %s", index, len(accounts), account["handle"])
        process_account(instagram, supabase, account, snapshot_date)

        if index < len(accounts):
            delay_seconds = random.uniform(2, 5)
            logger.info("Sleeping %.2f seconds before next account", delay_seconds)
            time.sleep(delay_seconds)

    logger.info("Run complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
