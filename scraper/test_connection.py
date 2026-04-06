from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

from scrape import (
    ENV_PATH,
    build_rocketapi_session,
    build_supabase,
    get_active_instagram_accounts,
    logger,
    scrape_profile,
)


def choose_account(accounts: list[dict], handle: str | None) -> dict:
    if handle:
        normalized = handle.strip().lstrip("@").lower()
        for account in accounts:
            if str(account.get("handle", "")).lower() == normalized:
                return account
        raise RuntimeError(f"Handle not found in active Instagram accounts: {handle}")

    if not accounts:
        raise RuntimeError("No active Instagram accounts found in Supabase")

    return accounts[0]


def main() -> int:
    parser = argparse.ArgumentParser(description="Dry-run Supabase + RocketAPI Instagram scraper validation")
    parser.add_argument("--handle", help="Specific Instagram handle to test")
    args = parser.parse_args()

    load_dotenv(ENV_PATH if ENV_PATH.exists() else None)

    try:
        supabase = build_supabase()
        rocketapi = build_rocketapi_session()
        accounts = get_active_instagram_accounts(supabase)
        account = choose_account(accounts, args.handle)
        user, posts = scrape_profile(rocketapi, account["handle"])

        now_utc = datetime.now(timezone.utc)
        cutoff_7d = now_utc - timedelta(days=7)
        recent_posts = posts[:12]

        likes_7d = sum(post.likes for post in recent_posts)
        comments_7d = sum(post.comments for post in recent_posts)
        views_7d = sum(post.views for post in recent_posts if post.media_type == 2)
        followers = int(user.get("edge_followed_by", {}).get("count") or user.get("follower_count") or 0)
        following = int(user.get("edge_follow", {}).get("count") or user.get("following_count") or 0)
        engagement_rate = round(((likes_7d + comments_7d) / followers) * 100, 2) if followers > 0 else 0.0

        logger.info("Dry run successful at %s", now_utc.isoformat())
        logger.info("Target account id: %s", account["id"])
        logger.info("Target handle: @%s", account["handle"])
        logger.info("Followers: %s", followers)
        logger.info("Following: %s", following)
        logger.info("Fetched posts: %s", len(posts))
        logger.info("Views across last 7 days: %s", views_7d)
        logger.info("Likes across last 7 posts: %s", likes_7d)
        logger.info("Comments across last 7 posts: %s", comments_7d)
        logger.info("Engagement rate weekly: %s%%", engagement_rate)

        if posts:
            latest = posts[0]
            logger.info(
                "Latest post preview: url=https://www.instagram.com/p/%s/ likes=%s comments=%s views=%s",
                latest.shortcode,
                latest.likes,
                latest.comments,
                latest.views,
            )

        logger.info("No database writes were performed")
        return 0
    except Exception as exc:  # noqa: BLE001
        logger.exception("Dry run failed: %s", exc)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
