"""Elexon Data Manager and Live API Verification Client.

Loads and memory-indexes the pre-materialized January 2026 Elexon dataset
(FUELHH actuals and WINDFOR forecasts) for sub-15ms lookups, and provides
an on-demand live upstream verification probe.
"""

from __future__ import annotations

import json
import logging
import os
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from backend.schemas import LiveVerifyResponse

logger = logging.getLogger("elexon_client")

USER_AGENT = "Gridbricks-Terminal/1.0 (+https://github.com/kleeeoss/xqv9k)"
LIVE_VERIFY_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream?settlementDateFrom=2026-01-01&settlementDateTo=2026-01-01&fuelType=WIND"


class ElexonDataManager:
    def __init__(self, data_path: Optional[Path] = None) -> None:
        if data_path is None:
            data_path = Path(__file__).resolve().parent / "data" / "elexon_jan2026.json"
        self.data_path = data_path
        self.is_loaded = False

        # Raw datasets
        self.fuelhh_records: List[Dict[str, Any]] = []
        self.windfor_records: List[Dict[str, Any]] = []
        self.metadata: Dict[str, Any] = {}

        # Efficient In-Memory Lookups
        # (settlementDate, settlementPeriod) -> record
        self.fuelhh_by_date_sp: Dict[Tuple[str, int], Dict[str, Any]] = {}
        # startTime -> record
        self.fuelhh_by_start_time: Dict[str, Dict[str, Any]] = {}

        # publishTime -> {startTime -> generation}
        self.windfor_runs: Dict[str, Dict[str, float]] = {}
        # Sorted list of unique publish times
        self.unique_publish_times: List[str] = []

        # Target startTime -> List of {publishTime, generation}
        self.windfor_by_target_time: Dict[str, List[Dict[str, Any]]] = {}

        self.load_data()

    def load_data(self) -> None:
        if not self.data_path.exists():
            fallback_candidates = [
                Path.cwd() / "backend" / "data" / "elexon_jan2026.json",
                Path("/var/task/backend/data/elexon_jan2026.json"),
                Path.cwd() / "data" / "elexon_jan2026.json",
                Path(__file__).resolve().parent.parent / "backend" / "data" / "elexon_jan2026.json",
            ]
            for candidate in fallback_candidates:
                if candidate.exists():
                    self.data_path = candidate
                    break

        if not self.data_path.exists():
            logger.warning("Dataset not found at %s. Attempting fallback...", self.data_path)
            return

        t0 = time.time()
        with open(self.data_path, "r", encoding="utf-8") as f:
            raw = json.load(f)

        self.metadata = raw.get("metadata", {})
        self.fuelhh_records = raw.get("fuelhh", [])
        self.windfor_records = raw.get("windfor", [])

        # Index FUELHH
        for r in self.fuelhh_records:
            s_date = r.get("settlementDate")
            sp = r.get("settlementPeriod")
            s_time = r.get("startTime")
            if s_date and sp is not None:
                self.fuelhh_by_date_sp[(s_date, int(sp))] = r
            if s_time:
                self.fuelhh_by_start_time[s_time] = r

        # Index WINDFOR runs
        for r in self.windfor_records:
            p_time = r.get("publishTime")
            s_time = r.get("startTime")
            gen = r.get("generation")
            if p_time and s_time and gen is not None:
                if p_time not in self.windfor_runs:
                    self.windfor_runs[p_time] = {}
                self.windfor_runs[p_time][s_time] = float(gen)

                if s_time not in self.windfor_by_target_time:
                    self.windfor_by_target_time[s_time] = []
                self.windfor_by_target_time[s_time].append({
                    "publishTime": p_time,
                    "generation": float(gen),
                })

        self.unique_publish_times = sorted(self.windfor_runs.keys())
        for s_time in self.windfor_by_target_time:
            self.windfor_by_target_time[s_time].sort(key=lambda x: x["publishTime"])

        self.is_loaded = True
        logger.info(
            "Loaded Elexon snapshot: %d FUELHH, %d WINDFOR runs (%d records) in %.3fs",
            len(self.fuelhh_records),
            len(self.unique_publish_times),
            len(self.windfor_records),
            time.time() - t0,
        )

    def get_actual_generation(self, settlement_date: str, settlement_period: int) -> Optional[float]:
        rec = self.fuelhh_by_date_sp.get((settlement_date, settlement_period))
        if rec and "generation" in rec:
            return float(rec["generation"])
        return None

    def get_actual_by_start_time(self, start_time_utc: str) -> Optional[float]:
        rec = self.fuelhh_by_start_time.get(start_time_utc)
        if rec and "generation" in rec:
            return float(rec["generation"])
        return None

    def get_latest_publish_time_before(self, cutoff_utc: str) -> Optional[str]:
        """Strict Point-in-Time selection: tau* = max { tp <= T_cutoff }."""
        valid_runs = [p for p in self.unique_publish_times if p <= cutoff_utc]
        if not valid_runs:
            return None
        return valid_runs[-1]

    def get_forecast_generation(self, publish_time: str, start_time: str) -> Optional[float]:
        run = self.windfor_runs.get(publish_time)
        if run:
            return run.get(start_time)
        return None

    def get_all_forecasts_for_target(self, start_time_utc: str) -> List[Dict[str, Any]]:
        return self.windfor_by_target_time.get(start_time_utc, [])

    @staticmethod
    def live_verify(timeout_s: float = 4.0) -> LiveVerifyResponse:
        t0 = time.time()
        req = urllib.request.Request(LIVE_VERIFY_URL, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=timeout_s) as resp:
                elapsed_ms = (time.time() - t0) * 1000.0
                if resp.status == 200:
                    raw = resp.read().decode("utf-8")
                    data = json.loads(raw)
                    sample = data[0] if (isinstance(data, list) and data) else None
                    return LiveVerifyResponse(
                        status="healthy",
                        timestamp_utc=datetime.now(timezone.utc).isoformat(),
                        latency_ms=round(elapsed_ms, 2),
                        endpoint_tested=LIVE_VERIFY_URL,
                        sample_record=sample,
                        is_live=True,
                    )
                else:
                    return LiveVerifyResponse(
                        status="upstream_error",
                        timestamp_utc=datetime.now(timezone.utc).isoformat(),
                        latency_ms=round(elapsed_ms, 2),
                        endpoint_tested=LIVE_VERIFY_URL,
                        sample_record=None,
                        is_live=False,
                    )
        except Exception as exc:
            elapsed_ms = (time.time() - t0) * 1000.0
            return LiveVerifyResponse(
                status=f"connection_failed: {str(exc)}",
                timestamp_utc=datetime.now(timezone.utc).isoformat(),
                latency_ms=round(elapsed_ms, 2),
                endpoint_tested=LIVE_VERIFY_URL,
                sample_record=None,
                is_live=False,
            )


# Global singleton manager instance
data_manager = ElexonDataManager()
