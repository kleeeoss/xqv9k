"""Elexon BMRS Data Ingestion Script.

Fetches January 2026 wind outturn (FUELHH) and forecast (WINDFOR) data
from the live Elexon BMRS API and serializes it to backend/data/elexon_jan2026.json.
Supports decision scope (Dec 30 2025 -> Feb 2 2026) to allow full analysis
for both decision-window and delivery-window interpretations.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("elexon_ingest")

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
USER_AGENT = "Gridbricks-Terminal/1.0 (+https://github.com/kleeeoss/xqv9k)"


def fetch_url_json(url: str, timeout: int = 30, retries: int = 3) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                if response.status != 200:
                    raise RuntimeError(f"HTTP {response.status}: {response.reason}")
                raw = response.read().decode("utf-8")
                return json.loads(raw)
        except Exception as exc:
            logger.warning("Attempt %d/%d failed for %s: %s", attempt, retries, url, exc)
            if attempt == retries:
                raise
            time.sleep(2**attempt)


def fetch_fuelhh(start_date: str = "2025-12-31", end_date: str = "2026-02-01") -> List[Dict[str, Any]]:
    """Fetch FUELHH actual wind generation records."""
    url = f"{BASE_URL}/FUELHH/stream?settlementDateFrom={start_date}&settlementDateTo={end_date}&fuelType=WIND"
    logger.info("Fetching FUELHH records from %s to %s...", start_date, end_date)
    t0 = time.time()
    data = fetch_url_json(url, timeout=30)
    logger.info("Fetched %d FUELHH records in %.2fs", len(data), time.time() - t0)
    return data


def fetch_windfor(
    start_dt: datetime = datetime(2025, 12, 30),
    end_dt: datetime = datetime(2026, 2, 2),
    chunk_days: int = 5,
) -> List[Dict[str, Any]]:
    """Fetch WINDFOR forecast runs chunked by publishDateTime."""
    logger.info("Fetching WINDFOR forecast runs from %s to %s in %d-day chunks...", start_dt, end_dt, chunk_days)
    all_records: List[Dict[str, Any]] = []
    curr = start_dt
    t0 = time.time()

    while curr < end_dt:
        next_curr = min(curr + timedelta(days=chunk_days), end_dt)
        p_from = curr.strftime("%Y-%m-%dT00:00:00Z")
        p_to = next_curr.strftime("%Y-%m-%dT00:00:00Z")
        url = f"{BASE_URL}/WINDFOR/stream?publishDateTimeFrom={p_from}&publishDateTimeTo={p_to}"
        logger.info("Fetching WINDFOR chunk: %s -> %s", p_from, p_to)
        chunk = fetch_url_json(url, timeout=30)
        logger.info("  Received %d records", len(chunk))
        all_records.extend(chunk)
        curr = next_curr

    logger.info("Fetched total %d WINDFOR records in %.2fs", len(all_records), time.time() - t0)
    return all_records


def main() -> None:
    output_dir = Path(__file__).resolve().parent.parent / "data"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "elexon_jan2026.json"

    logger.info("Starting Elexon BMRS empirical dataset ingestion...")
    t_start = time.time()

    fuelhh_records = fetch_fuelhh("2025-12-31", "2026-02-01")
    windfor_records = fetch_windfor(datetime(2025, 12, 30), datetime(2026, 2, 2))

    dataset = {
        "metadata": {
            "source": "Elexon BMRS API v1 (/datasets/FUELHH/stream & /datasets/WINDFOR/stream)",
            "generated_utc": datetime.now(timezone.utc).isoformat(),
            "fuelhh_record_count": len(fuelhh_records),
            "windfor_record_count": len(windfor_records),
            "date_range": {
                "fuelhh": {"from": "2025-12-31", "to": "2026-02-01"},
                "windfor": {"from": "2025-12-30T00:00:00Z", "to": "2026-02-02T00:00:00Z"},
            },
        },
        "fuelhh": fuelhh_records,
        "windfor": windfor_records,
    }

    logger.info("Writing dataset to %s...", output_file)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(dataset, f, separators=(",", ":"))

    size_mb = os.path.getsize(output_file) / (1024 * 1024)
    logger.info(
        "Successfully saved %s (%.2f MB) with %d FUELHH and %d WINDFOR records in %.2fs",
        output_file.name,
        size_mb,
        len(fuelhh_records),
        len(windfor_records),
        time.time() - t_start,
    )


if __name__ == "__main__":
    main()
