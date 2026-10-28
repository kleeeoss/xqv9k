"""Pydantic V2 Schemas for Gridbricks Day-Ahead Risk Terminal."""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class GateClosureEnum(str, Enum):
    EPEX_0920 = "09:20"
    N2EX_0950 = "09:50"
    GB_1530 = "15:30"


class ScopeEnum(str, Enum):
    DELIVERY_JAN = "delivery_jan"
    DECISION_JAN = "decision_jan"


class InterpolationEnum(str, Enum):
    LINEAR = "linear"
    EXACT = "exact"


class SettlementPeriodRow(BaseModel):
    settlement_period: int = Field(..., ge=1, le=48)
    start_time_utc: str
    forecast_mw: float
    firm_wind_mw: float
    upper_band_mw: float
    actual_mw: Optional[float] = None
    demand_mw: float
    naive_thermal_mw: float
    recommended_thermal_mw: float
    shortfall_buffer_mw: float
    signed_error_mw: Optional[float] = None
    lead_time_hours: float
    publish_time_used: str


class TradingDeskKPIs(BaseModel):
    expected_wind_energy_mwh: float
    firm_wind_energy_mwh: float
    total_demand_energy_mwh: float
    naive_thermal_mwh: float
    recommended_thermal_mwh: float
    shortfall_buffer_mwh: float
    actual_wind_energy_mwh: Optional[float] = None
    imbalance_savings_estimate_gbp: Optional[float] = None


class TradingDeskResponse(BaseModel):
    delivery_date: str
    gate_closure: str
    decision_cutoff_utc: str
    selected_publish_time_utc: str
    confidence_level: float
    demand_mw: float
    interpolation: str
    kpis: TradingDeskKPIs
    periods: List[SettlementPeriodRow]


class GlobalMetrics(BaseModel):
    mae_mw: float
    rmse_mw: float
    mbe_mw: float
    mape_pct: float
    nmae_pct: float
    p10_shortfall_mw: float
    p50_shortfall_mw: float
    p75_shortfall_mw: float
    p90_shortfall_mw: float
    p95_shortfall_mw: float
    max_shortfall_mw: float
    max_surplus_mw: float
    mean_lead_time_hours: float


class HorizonError(BaseModel):
    horizon_bucket: str
    sample_count: int
    mae_mw: float
    rmse_mw: float
    mbe_mw: float


class DiurnalPeriod(BaseModel):
    settlement_period: int
    time_label: str
    mae_mw: float
    rmse_mw: float
    mbe_mw: float
    p90_shortfall_mw: float
    mean_actual_mw: float
    mean_forecast_mw: float


class DailyTimelinePoint(BaseModel):
    date: str
    mae_mw: float
    rmse_mw: float
    mbe_mw: float
    mean_forecast_mw: float
    mean_actual_mw: float
    peak_shortfall_mw: float


class HistogramBin(BaseModel):
    bin_start_mw: float
    bin_end_mw: float
    bin_label: str
    frequency: int


class WorstShortfall(BaseModel):
    rank: int
    date: str
    settlement_period: int
    start_time_utc: str
    forecast_mw: float
    actual_mw: float
    shortfall_mw: float
    lead_time_hours: float


class AccuracyAuditResponse(BaseModel):
    evaluation_scope: str
    gate_closure: str
    interpolation: str
    sample_count: int
    global_metrics: GlobalMetrics
    error_by_horizon: List[HorizonError]
    diurnal_by_settlement_period: List[DiurnalPeriod]
    daily_timeline: List[DailyTimelinePoint]
    error_histogram: List[HistogramBin]
    top_worst_shortfalls: List[WorstShortfall]


class EvolutionRunPoint(BaseModel):
    publish_time_utc: str
    lead_time_hours: float
    forecast_mw: float
    signed_error_mw: Optional[float] = None
    shortfall_mw: Optional[float] = None


class ForecastEvolutionResponse(BaseModel):
    target_start_time_utc: str
    settlement_date: str
    settlement_period: int
    actual_mw: Optional[float] = None
    runs: List[EvolutionRunPoint]


class LiveVerifyResponse(BaseModel):
    status: str
    timestamp_utc: str
    latency_ms: float
    endpoint_tested: str
    sample_record: Optional[Dict[str, Any]] = None
    is_live: bool
