"""FastAPI Application for Gridbricks Wholesale Electricity Risk Terminal.

Provides Day-Ahead trading desk forecasts, thermal procurement schedules,
empirical forecast accuracy audits, horizon evolution drilldowns, and live
Elexon API verification.
"""

from __future__ import annotations

from datetime import date
import logging
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.elexon_client import ElexonDataManager, data_manager
from backend.engine import AlgorithmicEngine, engine
from backend.schemas import (
    AccuracyAuditResponse,
    ForecastEvolutionResponse,
    GateClosureEnum,
    InterpolationEnum,
    LiveVerifyResponse,
    ScopeEnum,
    TradingDeskResponse,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("gridbricks_api")

# Historical January 2026 Evaluation Date Bounds
MIN_JAN_2026_DATE = date(2026, 1, 1)
MAX_JAN_2026_DATE = date(2026, 1, 31)

app = FastAPI(
    title="Gridbricks UK Wholesale Day-Ahead Energy & Forecast Risk Terminal",
    description=(
        "Production-grade algorithmic energy trading terminal for the UK wholesale power market. "
        "Evaluates point-in-time Elexon BMRS renewable wind forecast errors, computes empirical "
        "shortfall quantiles (VaR), and schedules risk-adjusted thermal procurement to minimize "
        "Balancing Mechanism cash-out penalties."
    ),
    version="1.0.0",
)

# Enable CORS for development and cross-origin access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def validate_delivery_date(delivery_date: str) -> str:
    """Validate that delivery_date conforms to YYYY-MM-DD and falls strictly in January 2026."""
    try:
        parsed_date = date.fromisoformat(delivery_date)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid delivery_date format '{delivery_date}'. Expected ISO format YYYY-MM-DD.",
        )

    if parsed_date < MIN_JAN_2026_DATE or parsed_date > MAX_JAN_2026_DATE:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Delivery date '{delivery_date}' is outside the historical evaluation scope. "
                "Supported delivery dates are strictly January 1, 2026 to January 31, 2026."
            ),
        )

    return delivery_date


@app.get("/api/health", summary="API Health Check")
def health_check() -> dict:
    return {
        "status": "online",
        "service": "Gridbricks Day-Ahead Risk Terminal",
        "data_loaded": data_manager.is_loaded,
        "fuelhh_records": len(data_manager.fuelhh_records),
        "windfor_runs": len(data_manager.unique_publish_times),
    }


@app.get("/api/trading-desk", response_model=TradingDeskResponse, summary="Day-Ahead Trading Desk Forecast & Dispatch")
def get_trading_desk(
    delivery_date: str = Query("2026-01-02", description="Delivery date (YYYY-MM-DD), strictly 2026-01-01 to 2026-01-31"),
    gate_closure: GateClosureEnum = Query(GateClosureEnum.EPEX_0920, description="Auction gate closure time UTC"),
    confidence_level: float = Query(0.90, ge=0.10, le=0.99, description="Shortfall VaR confidence level (0.50, 0.75, 0.90, 0.95)"),
    demand_mw: float = Query(22000.0, ge=5000.0, le=50000.0, description="Expected portfolio peak demand (MW)"),
    scope: ScopeEnum = Query(ScopeEnum.DELIVERY_JAN, description="Evaluation scope: delivery_jan or decision_jan"),
    interpolation: InterpolationEnum = Query(InterpolationEnum.LINEAR, description="Resolution mode: linear (48 SP) or exact (24 SP)"),
) -> TradingDeskResponse:
    validate_delivery_date(delivery_date)
    try:
        return engine.generate_trading_desk_view(
            delivery_date=delivery_date,
            gate_closure=gate_closure.value,
            confidence_level=confidence_level,
            demand_mw=demand_mw,
            scope=scope.value,
            interpolation=interpolation.value,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error in trading-desk endpoint: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/accuracy-audit", response_model=AccuracyAuditResponse, summary="January 2026 Forecast Accuracy Audit")
def get_accuracy_audit(
    gate_closure: GateClosureEnum = Query(GateClosureEnum.EPEX_0920, description="Auction gate closure time UTC"),
    scope: ScopeEnum = Query(ScopeEnum.DELIVERY_JAN, description="Evaluation scope: delivery_jan or decision_jan"),
    interpolation: InterpolationEnum = Query(InterpolationEnum.LINEAR, description="Resolution mode: linear or exact"),
) -> AccuracyAuditResponse:
    try:
        return engine.generate_accuracy_audit_view(
            gate_closure=gate_closure.value,
            scope=scope.value,
            interpolation=interpolation.value,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error in accuracy-audit endpoint: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/forecast-evolution", response_model=ForecastEvolutionResponse, summary="Forecast Progression Horizon Cone")
def get_forecast_evolution(
    start_time: str = Query("2026-01-02T19:00:00Z", description="Target settlement start time ISO UTC"),
) -> ForecastEvolutionResponse:
    try:
        return engine.generate_forecast_evolution(start_time_utc=start_time)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error in forecast-evolution endpoint: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/elexon/live-verify", response_model=LiveVerifyResponse, summary="Live Elexon BMRS API Connectivity Probe")
def verify_elexon_live() -> LiveVerifyResponse:
    return data_manager.live_verify()


# Frontend static files mounting for unified Docker/local serving
frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.exists() and (frontend_dist / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend_spa(full_path: str):
        file_candidate = frontend_dist / full_path
        if file_candidate.is_file():
            return FileResponse(file_candidate)
        return FileResponse(frontend_dist / "index.html")
