from __future__ import annotations

import sys

from dotenv import load_dotenv

from scrape import ENV_PATH, build_instagram_client, logger, resolve_path, env_required


def main() -> int:
    load_dotenv(ENV_PATH if ENV_PATH.exists() else None)

    try:
        client = build_instagram_client()
        session_file = resolve_path(env_required("IG_SESSION_FILE"))
        account = client.account_info()
        logger.info("Instagram session ready for @%s", getattr(account, "username", "unknown"))
        logger.info("Session file: %s", session_file)
        return 0
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to create/validate Instagram session: %s", exc)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
