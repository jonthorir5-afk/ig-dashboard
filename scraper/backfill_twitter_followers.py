from __future__ import annotations

import argparse
import logging
import os
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client as SupabaseClient
from supabase import create_client


BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("twitter-followers-backfill")


@dataclass
class SnapshotRow:
    id: str
    account_id: str
    snapshot_date: str
    followers: int | None


def env_required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def build_supabase() -> SupabaseClient:
    return create_client(env_required("SUPABASE_URL"), env_required("SUPABASE_SERVICE_KEY"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill bad zero-follower Twitter snapshots from the last known non-zero value.")
    parser.add_argument(
        "--start-date",
        default=(date.today() - timedelta(days=3)).isoformat(),
        help="Inclusive start date in YYYY-MM-DD format. Defaults to 3 days ago.",
    )
    parser.add_argument(
        "--end-date",
        default=date.today().isoformat(),
        help="Inclusive end date in YYYY-MM-DD format. Defaults to today.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview the rows that would be updated without writing to Supabase.",
    )
    return parser.parse_args()


def validate_date(value: str) -> str:
    datetime.strptime(value, "%Y-%m-%d")
    return value


def get_twitter_account_ids(supabase: SupabaseClient) -> list[str]:
    response = (
        supabase.table("accounts")
        .select("id")
        .eq("platform", "twitter")
        .execute()
    )
    return [row["id"] for row in (response.data or []) if row.get("id")]


def get_twitter_snapshots(supabase: SupabaseClient, account_ids: list[str], start_date: str) -> list[SnapshotRow]:
    if not account_ids:
        return []

    response = (
        supabase.table("snapshots")
        .select("id,account_id,snapshot_date,followers")
        .in_("account_id", account_ids)
        .gte("snapshot_date", start_date)
        .order("account_id")
        .order("snapshot_date")
        .execute()
    )

    rows: list[SnapshotRow] = []
    for item in response.data or []:
        rows.append(
            SnapshotRow(
                id=item["id"],
                account_id=item["account_id"],
                snapshot_date=item["snapshot_date"],
                followers=item.get("followers"),
            )
        )
    return rows


def build_updates(rows: list[SnapshotRow], start_date: str, end_date: str) -> list[tuple[SnapshotRow, int]]:
    updates: list[tuple[SnapshotRow, int]] = []
    last_non_zero_by_account: dict[str, int] = {}
    grouped: dict[str, list[SnapshotRow]] = defaultdict(list)

    for row in rows:
        grouped[row.account_id].append(row)

    for account_rows in grouped.values():
        for row in account_rows:
            followers = row.followers
            if followers not in (None, 0):
                last_non_zero_by_account[row.account_id] = int(followers)
                continue

            if not (start_date <= row.snapshot_date <= end_date):
                continue

            previous = last_non_zero_by_account.get(row.account_id)
            if previous is None:
                continue

            updates.append((row, previous))

    return updates


def apply_updates(supabase: SupabaseClient, updates: list[tuple[SnapshotRow, int]], dry_run: bool) -> None:
    if not updates:
        logger.info("No Twitter snapshot rows needed backfill.")
        return

    for row, followers in updates:
        logger.info(
            "[account_id=%s] backfill %s followers: %s -> %s",
            row.account_id,
            row.snapshot_date,
            row.followers,
            followers,
        )
        if dry_run:
            continue

        supabase.table("snapshots").update({"followers": followers}).eq("id", row.id).execute()


def main() -> int:
    args = parse_args()
    start_date = validate_date(args.start_date)
    end_date = validate_date(args.end_date)

    if end_date < start_date:
        raise RuntimeError("end-date must be on or after start-date")

    load_dotenv(ENV_PATH)
    supabase = build_supabase()
    account_ids = get_twitter_account_ids(supabase)
    lookback_start = min(start_date, (date.fromisoformat(start_date) - timedelta(days=30)).isoformat())
    rows = get_twitter_snapshots(supabase, account_ids, lookback_start)
    updates = build_updates(rows, start_date, end_date)

    logger.info(
        "Twitter follower backfill scan complete | accounts=%s rows=%s updates=%s dry_run=%s",
        len(account_ids),
        len(rows),
        len(updates),
        args.dry_run,
    )
    apply_updates(supabase, updates, args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
