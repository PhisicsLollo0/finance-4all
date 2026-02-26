#!/usr/bin/env python3
"""
Standalone script to refresh historical market-index data from curvo.eu.

Designed to be called from GitHub Actions (or locally).
Usage:
    python backend/scripts/refresh_data.py
"""

import asyncio
import json
import sys
from pathlib import Path

# Ensure backend/ is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.business_logics.data_refresh import refresh_historical_data  # noqa: E402


async def main() -> int:
    result = await refresh_historical_data()
    print(json.dumps(result, indent=2))

    if result["status"] == "ok":
        print(f"\n✅ All {len(result['downloaded'])} indexes refreshed successfully.")
        return 0
    elif result["status"] == "partial":
        print(f"\n⚠️  Partial refresh: {len(result['downloaded'])} OK, {len(result['failed'])} failed.")
        return 0  # still commit what we got
    else:
        print(f"\n❌ Refresh failed: {result['message']}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
