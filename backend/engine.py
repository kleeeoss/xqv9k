"""Quantitative Risk & Algorithmic Causality Engine.

Implements:
1. Zero-lookahead Point-in-Time forecast matching: tau* = max { tp <= T_cutoff }
2. Dual-mode resolution alignment (linear half-hourly interpolation vs exact hourly matching)
3. Mathematical error metric evaluation (MAE, RMSE, MBE, MAPE, NMAE)
4. Empirical quantile Shortfall Value-at-Risk (VaR_alpha)
5. Risk-adjusted Day-Ahead thermal procurement dispatching:
   - W_firm = max(0, W_hat - Q_alpha(S))
   - P_naive = max(0, D - W_hat)
   - P_rec = max(0, D - W_firm)
   - Delta P_buffer = P_rec - P_naive
6. Balancing Mechanism cash-out savings estimation
7. Horizon error degradation, diurnal profiles, error histograms, and worst-miss ranking
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from backend.elexon_client import ElexonDataManager, data_manager
from backend.schemas import (
    AccuracyAuditResponse,
    DailyTimelinePoint,
    DiurnalPeriod,
    EvolutionRunPoint,
    ForecastEvolutionResponse,
    GateClosureEnum,
    GlobalMetrics,
    HistogramBin,
    HorizonError,
    InterpolationEnum,
    ScopeEnum,
    SettlementPeriodRow,
    TradingDeskKPIs,
    TradingDeskResponse,
    WorstShortfall,
)

# Standard UK Winter Normalized Diurnal Demand Shape (48 Settlement Periods)
# Peak in late afternoon / evening (SP 34-38 ~ 17:00-19:00 UTC), trough overnight (SP 7-12)
DIURNAL_DEMAND_FACTORS = [
    0.72, 0.70, 0.68, 0.67, 0.66, 0.66, 0.67, 0.69,  # SP 1-8 (00:00 - 04:00)
    0.73, 0.78, 0.85, 0.94, 1.02, 1.08, 1.11, 1.12,  # SP 9-16 (04:00 - 08:00)
    1.12, 1.11, 1.10, 1.09, 1.08, 1.07, 1.06, 1.05,  # SP 17-24 (08:00 - 12:00)
    1.04, 1.03, 1.03, 1.03, 1.04, 1.06, 1.10, 1.15,  # SP 25-32 (12:00 - 16:00)
    1.22, 1.28, 1.30, 1.28, 1.24, 1.19, 1.14, 1.09,  # SP 33-40 (16:00 - 20:00)
    1.02, 0.96, 0.90, 0.84, 0.80, 0.77, 0.74, 0.73,  # SP 41-48 (20:00 - 24:00)
]

C_DA_PRICE = 85.0  # Day-Ahead wholesale power price benchmark (£/MWh)
C_SBP_PEAK = 180.0  # Balancing Mechanism peak System Buy Price benchmark (£/MWh)
DELTA_SBP = C_SBP_PEAK - C_DA_PRICE  # Cash-out shortfall premium penalty (£95/MWh)


def compute_decision_cutoff(delivery_date: str, gate_closure: str) -> str:
    """Calculate T_cutoff = Date(delivery) - 1 day + gate_closure.

    Example: delivery_date='2026-01-02', gate_closure='09:20'
    -> cutoff = '2026-01-01T09:20:00Z'
    """
    dt = datetime.strptime(delivery_date, "%Y-%m-%d")
    decision_dt = dt - timedelta(days=1)
    return f"{decision_dt.strftime('%Y-%m-%d')}T{gate_closure}:00Z"


def get_half_hour_timestamp(delivery_date: str, settlement_period: int) -> str:
    """Return ISO UTC timestamp for a given settlement period (1-48).

    SP 1 -> 00:00:00Z, SP 2 -> 00:30:00Z, SP 48 -> 23:30:00Z.
    """
    dt = datetime.strptime(delivery_date, "%Y-%m-%d")
    minutes = (settlement_period - 1) * 30
    period_dt = dt + timedelta(minutes=minutes)
    return period_dt.strftime("%Y-%m-%dT%H:%M:00Z")


def compute_lead_time_hours(target_time_utc: str, publish_time_utc: str) -> float:
    t_target = datetime.fromisoformat(target_time_utc.replace("Z", "+00:00"))
    t_publish = datetime.fromisoformat(publish_time_utc.replace("Z", "+00:00"))
    delta_sec = (t_target - t_publish).total_seconds()
    return round(delta_sec / 3600.0, 2)


class AlgorithmicEngine:
    def __init__(self, manager: Optional[ElexonDataManager] = None) -> None:
        self.manager = manager or data_manager

    def interpolate_forecast(
        self,
        publish_time: str,
        target_time_utc: str,
        interpolation: str = "linear",
    ) -> Optional[float]:
        """Fetch forecast from run `publish_time` for `target_time_utc`.

        If exact (:00), return native generation.
        If :30 and linear mode, return average of :00 and :00(+1h).
        """
        run = self.manager.windfor_runs.get(publish_time)
        if not run:
            return None

        # Check native exact lookup first
        if target_time_utc in run:
            return run[target_time_utc]

        if interpolation != "linear":
            return None

        # Half-hour linear interpolation
        dt = datetime.fromisoformat(target_time_utc.replace("Z", "+00:00"))
        if dt.minute == 30:
            dt_prev = dt.replace(minute=0)
            dt_next = dt_prev + timedelta(hours=1)
            t_prev = dt_prev.strftime("%Y-%m-%dT%H:%M:00Z")
            t_next = dt_next.strftime("%Y-%m-%dT%H:%M:00Z")

            gen_prev = run.get(t_prev)
            gen_next = run.get(t_next)

            if gen_prev is not None and gen_next is not None:
                return round((gen_prev + gen_next) / 2.0, 1)
            elif gen_prev is not None:
                return gen_prev
            elif gen_next is not None:
                return gen_next

        return None

    def evaluate_scope_residuals(
        self,
        scope: str = "delivery_jan",
        gate_closure: str = "09:20",
        interpolation: str = "linear",
    ) -> List[Dict[str, Any]]:
        """Evaluate point-in-time aligned residuals across the evaluation scope.

        Scope 'delivery_jan': deliveries 2026-01-01 to 2026-01-31 (decisions Dec 31 to Jan 30).
        Scope 'decision_jan': decisions 2026-01-01 to 2026-01-31 (deliveries Jan 02 to Feb 01).
        """
        if scope == "decision_jan":
            # Decisions Jan 1 to Jan 31 -> Deliveries Jan 2 to Feb 1
            start_date = datetime(2026, 1, 2)
            end_date = datetime(2026, 2, 1)
        else:
            # Deliveries Jan 1 to Jan 31 -> Decisions Dec 31 to Jan 30
            start_date = datetime(2026, 1, 1)
            end_date = datetime(2026, 1, 31)

        aligned_records: List[Dict[str, Any]] = []
        curr = start_date
        while curr <= end_date:
            delivery_date_str = curr.strftime("%Y-%m-%d")
            cutoff_utc = compute_decision_cutoff(delivery_date_str, gate_closure)
            pub_time = self.manager.get_latest_publish_time_before(cutoff_utc)

            if pub_time:
                for sp in range(1, 49):
                    t_str = get_half_hour_timestamp(delivery_date_str, sp)
                    is_exact_hour = (sp % 2 != 0)  # SP 1 = 00:00, SP 3 = 01:00...

                    if interpolation == "exact" and not is_exact_hour:
                        continue

                    f_mw = self.interpolate_forecast(pub_time, t_str, interpolation=interpolation)
                    a_mw = self.manager.get_actual_generation(delivery_date_str, sp)

                    if f_mw is not None and a_mw is not None:
                        err = f_mw - a_mw
                        shortfall = max(0.0, err)
                        surplus = max(0.0, -err)
                        lead_time = compute_lead_time_hours(t_str, pub_time)

                        aligned_records.append({
                            "delivery_date": delivery_date_str,
                            "settlement_period": sp,
                            "start_time_utc": t_str,
                            "publish_time_used": pub_time,
                            "lead_time_hours": lead_time,
                            "forecast_mw": f_mw,
                            "actual_mw": a_mw,
                            "signed_error_mw": err,
                            "shortfall_mw": shortfall,
                            "surplus_mw": surplus,
                        })
            curr += timedelta(days=1)

        return aligned_records

    def compute_shortfall_quantiles(
        self,
        residuals: List[Dict[str, Any]],
    ) -> Dict[str, float]:
        """Compute empirical shortfall and surplus quantiles."""
        if not residuals:
            return {
                "p10_shortfall": 0.0,
                "p50_shortfall": 0.0,
                "p75_shortfall": 0.0,
                "p90_shortfall": 0.0,
                "p95_shortfall": 0.0,
                "p90_surplus": 0.0,
            }

        shortfalls = np.array([r["shortfall_mw"] for r in residuals], dtype=float)
        surpluses = np.array([r["surplus_mw"] for r in residuals], dtype=float)

        return {
            "p10_shortfall": float(np.percentile(shortfalls, 10)),
            "p50_shortfall": float(np.percentile(shortfalls, 50)),
            "p75_shortfall": float(np.percentile(shortfalls, 75)),
            "p90_shortfall": float(np.percentile(shortfalls, 90)),
            "p95_shortfall": float(np.percentile(shortfalls, 95)),
            "p90_surplus": float(np.percentile(surpluses, 90)),
        }

    def generate_trading_desk_view(
        self,
        delivery_date: str,
        gate_closure: str = "09:20",
        confidence_level: float = 0.90,
        demand_mw: float = 22000.0,
        scope: str = "delivery_jan",
        interpolation: str = "linear",
    ) -> TradingDeskResponse:
        """Construct full 48-period Day-Ahead Trading Desk response."""
        cutoff_utc = compute_decision_cutoff(delivery_date, gate_closure)
        pub_time = self.manager.get_latest_publish_time_before(cutoff_utc)

        if not pub_time:
            # Fallback to earliest available if before dataset range
            pub_time = self.manager.unique_publish_times[0] if self.manager.unique_publish_times else cutoff_utc

        # Empirical quantile buffer derived from month's aligned residuals
        aligned_residuals = self.evaluate_scope_residuals(
            scope=scope, gate_closure=gate_closure, interpolation=interpolation
        )
        quantiles = self.compute_shortfall_quantiles(aligned_residuals)

        # Lookup target confidence shortfall buffer Q_alpha(S)
        if aligned_residuals:
            all_shortfalls = np.array([r["shortfall_mw"] for r in aligned_residuals], dtype=float)
            q_alpha_buffer = float(np.percentile(all_shortfalls, confidence_level * 100.0))
            all_surpluses = np.array([r["surplus_mw"] for r in aligned_residuals], dtype=float)
            q_alpha_surplus = float(np.percentile(all_surpluses, confidence_level * 100.0))
        else:
            q_alpha_buffer = 1200.0
            q_alpha_surplus = 1200.0

        periods: List[SettlementPeriodRow] = []

        sum_forecast_mwh = 0.0
        sum_firm_mwh = 0.0
        sum_demand_mwh = 0.0
        sum_naive_thermal_mwh = 0.0
        sum_rec_thermal_mwh = 0.0
        sum_buffer_mwh = 0.0
        sum_actual_mwh = 0.0
        actual_count = 0
        total_hedged_mwh = 0.0

        for sp in range(1, 49):
            is_exact_hour = (sp % 2 != 0)
            if interpolation == "exact" and not is_exact_hour:
                continue

            t_str = get_half_hour_timestamp(delivery_date, sp)
            f_mw = self.interpolate_forecast(pub_time, t_str, interpolation=interpolation) or 0.0
            a_mw = self.manager.get_actual_generation(delivery_date, sp)

            # Diurnal scaled consumer portfolio demand
            diurnal_factor = DIURNAL_DEMAND_FACTORS[sp - 1]
            sp_demand_mw = round(demand_mw * diurnal_factor, 1)

            # Mathematical formulations from Section 3
            # Firm Wind: W_firm = max(0, W_hat - Q_alpha(S))
            firm_wind_mw = max(0.0, round(f_mw - q_alpha_buffer, 1))

            # Upper prediction band for fan chart: W_hat + Q_alpha(surplus)
            upper_band_mw = round(f_mw + q_alpha_surplus, 1)

            # Naive Thermal: P_naive = max(0, D - W_hat)
            naive_thermal_mw = max(0.0, round(sp_demand_mw - f_mw, 1))

            # Recommended Thermal: P_rec = max(0, D - W_firm)
            rec_thermal_mw = max(0.0, round(sp_demand_mw - firm_wind_mw, 1))

            # Uncertainty Reserve Buffer: Delta P_buffer = P_rec - P_naive
            shortfall_buffer_mw = max(0.0, round(rec_thermal_mw - naive_thermal_mw, 1))

            lead_time = compute_lead_time_hours(t_str, pub_time)
            signed_err = round(f_mw - a_mw, 1) if a_mw is not None else None

            # Accounting for Energy MWh (each half hour = 0.5 hours)
            step_hours = 1.0 if interpolation == "exact" else 0.5
            sum_forecast_mwh += f_mw * step_hours
            sum_firm_mwh += firm_wind_mw * step_hours
            sum_demand_mwh += sp_demand_mw * step_hours
            sum_naive_thermal_mwh += naive_thermal_mw * step_hours
            sum_rec_thermal_mwh += rec_thermal_mw * step_hours
            sum_buffer_mwh += shortfall_buffer_mw * step_hours

            if a_mw is not None:
                sum_actual_mwh += a_mw * step_hours
                actual_count += 1
                sp_shortfall = max(0.0, f_mw - a_mw)
                # Protected shortfall volume: min(Shortfall, Buffer) * step_hours
                hedged_vol = min(sp_shortfall, shortfall_buffer_mw) * step_hours
                total_hedged_mwh += hedged_vol

            periods.append(
                SettlementPeriodRow(
                    settlement_period=sp,
                    start_time_utc=t_str,
                    forecast_mw=f_mw,
                    firm_wind_mw=firm_wind_mw,
                    upper_band_mw=upper_band_mw,
                    actual_mw=a_mw,
                    demand_mw=sp_demand_mw,
                    naive_thermal_mw=naive_thermal_mw,
                    recommended_thermal_mw=rec_thermal_mw,
                    shortfall_buffer_mw=shortfall_buffer_mw,
                    signed_error_mw=signed_err,
                    lead_time_hours=lead_time,
                    publish_time_used=pub_time,
                )
            )

        kpis = TradingDeskKPIs(
            expected_wind_energy_mwh=round(sum_forecast_mwh, 1),
            firm_wind_energy_mwh=round(sum_firm_mwh, 1),
            total_demand_energy_mwh=round(sum_demand_mwh, 1),
            naive_thermal_mwh=round(sum_naive_thermal_mwh, 1),
            recommended_thermal_mwh=round(sum_rec_thermal_mwh, 1),
            shortfall_buffer_mwh=round(sum_buffer_mwh, 1),
            actual_wind_energy_mwh=round(sum_actual_mwh, 1) if actual_count > 0 else None,
            imbalance_savings_estimate_gbp=round(total_hedged_mwh * DELTA_SBP, 2) if actual_count > 0 else None,
        )

        return TradingDeskResponse(
            delivery_date=delivery_date,
            gate_closure=gate_closure,
            decision_cutoff_utc=cutoff_utc,
            selected_publish_time_utc=pub_time,
            confidence_level=confidence_level,
            demand_mw=demand_mw,
            interpolation=interpolation,
            kpis=kpis,
            periods=periods,
        )

    def generate_accuracy_audit_view(
        self,
        gate_closure: str = "09:20",
        scope: str = "delivery_jan",
        interpolation: str = "linear",
    ) -> AccuracyAuditResponse:
        """Produce comprehensive institutional audit across the month."""
        aligned = self.evaluate_scope_residuals(
            scope=scope, gate_closure=gate_closure, interpolation=interpolation
        )

        if not aligned:
            # Empty fallback
            return AccuracyAuditResponse(
                evaluation_scope=scope,
                gate_closure=gate_closure,
                interpolation=interpolation,
                sample_count=0,
                global_metrics=GlobalMetrics(
                    mae_mw=0, rmse_mw=0, mbe_mw=0, mape_pct=0, nmae_pct=0,
                    p10_shortfall_mw=0, p50_shortfall_mw=0, p75_shortfall_mw=0,
                    p90_shortfall_mw=0, p95_shortfall_mw=0, max_shortfall_mw=0,
                    max_surplus_mw=0, mean_lead_time_hours=0,
                ),
                error_by_horizon=[],
                diurnal_by_settlement_period=[],
                daily_timeline=[],
                error_histogram=[],
                top_worst_shortfalls=[],
            )

        signed_errors = np.array([r["signed_error_mw"] for r in aligned], dtype=float)
        abs_errors = np.abs(signed_errors)
        actuals = np.array([r["actual_mw"] for r in aligned], dtype=float)
        shortfalls = np.array([r["shortfall_mw"] for r in aligned], dtype=float)
        surpluses = np.array([r["surplus_mw"] for r in aligned], dtype=float)
        leads = np.array([r["lead_time_hours"] for r in aligned], dtype=float)

        n = len(aligned)
        mae = float(np.mean(abs_errors))
        rmse = float(np.sqrt(np.mean(signed_errors**2)))
        mbe = float(np.mean(signed_errors))

        # Floored denominator prevents division by zero in MAPE
        floored_actuals = np.maximum(actuals, 100.0)
        mape = float(np.mean(abs_errors / floored_actuals) * 100.0)

        peak_wind = float(np.max(actuals)) if len(actuals) > 0 else 17805.0
        nmae = (mae / peak_wind) * 100.0 if peak_wind > 0 else 0.0

        p10_s = float(np.percentile(shortfalls, 10))
        p50_s = float(np.percentile(shortfalls, 50))
        p75_s = float(np.percentile(shortfalls, 75))
        p90_s = float(np.percentile(shortfalls, 90))
        p95_s = float(np.percentile(shortfalls, 95))

        global_metrics = GlobalMetrics(
            mae_mw=round(mae, 1),
            rmse_mw=round(rmse, 1),
            mbe_mw=round(mbe, 1),
            mape_pct=round(mape, 2),
            nmae_pct=round(nmae, 2),
            p10_shortfall_mw=round(p10_s, 1),
            p50_shortfall_mw=round(p50_s, 1),
            p75_shortfall_mw=round(p75_s, 1),
            p90_shortfall_mw=round(p90_s, 1),
            p95_shortfall_mw=round(p95_s, 1),
            max_shortfall_mw=round(float(np.max(shortfalls)), 1),
            max_surplus_mw=round(float(np.max(surpluses)), 1),
            mean_lead_time_hours=round(float(np.mean(leads)), 1),
        )

        # 1. Error by Horizon Buckets
        horizon_buckets_def = [
            ("6-12h", 6.0, 12.0),
            ("12-18h", 12.0, 18.0),
            ("18-24h", 18.0, 24.0),
            ("24-30h", 24.0, 30.0),
            ("30-36h", 30.0, 36.0),
            ("36-48h", 36.0, 48.0),
        ]
        error_by_horizon: List[HorizonError] = []
        for label, h_low, h_high in horizon_buckets_def:
            sub = [r for r in aligned if h_low <= r["lead_time_hours"] < h_high]
            if sub:
                sub_err = np.array([r["signed_error_mw"] for r in sub], dtype=float)
                error_by_horizon.append(
                    HorizonError(
                        horizon_bucket=label,
                        sample_count=len(sub),
                        mae_mw=round(float(np.mean(np.abs(sub_err))), 1),
                        rmse_mw=round(float(np.sqrt(np.mean(sub_err**2))), 1),
                        mbe_mw=round(float(np.mean(sub_err)), 1),
                    )
                )

        # 2. Diurnal by Settlement Period (1-48)
        diurnal_list: List[DiurnalPeriod] = []
        for sp in range(1, 49):
            sub = [r for r in aligned if r["settlement_period"] == sp]
            if sub:
                sub_err = np.array([r["signed_error_mw"] for r in sub], dtype=float)
                sub_short = np.array([r["shortfall_mw"] for r in sub], dtype=float)
                sub_act = np.array([r["actual_mw"] for r in sub], dtype=float)
                sub_for = np.array([r["forecast_mw"] for r in sub], dtype=float)

                m_time = (sp - 1) * 30
                time_lbl = f"{m_time // 60:02d}:{m_time % 60:02d}"

                diurnal_list.append(
                    DiurnalPeriod(
                        settlement_period=sp,
                        time_label=time_lbl,
                        mae_mw=round(float(np.mean(np.abs(sub_err))), 1),
                        rmse_mw=round(float(np.sqrt(np.mean(sub_err**2))), 1),
                        mbe_mw=round(float(np.mean(sub_err)), 1),
                        p90_shortfall_mw=round(float(np.percentile(sub_short, 90)), 1),
                        mean_actual_mw=round(float(np.mean(sub_act)), 1),
                        mean_forecast_mw=round(float(np.mean(sub_for)), 1),
                    )
                )

        # 3. Daily Timeline
        dates_sorted = sorted(list({r["delivery_date"] for r in aligned}))
        daily_timeline: List[DailyTimelinePoint] = []
        for d in dates_sorted:
            sub = [r for r in aligned if r["delivery_date"] == d]
            if sub:
                sub_err = np.array([r["signed_error_mw"] for r in sub], dtype=float)
                sub_act = np.array([r["actual_mw"] for r in sub], dtype=float)
                sub_for = np.array([r["forecast_mw"] for r in sub], dtype=float)
                sub_short = np.array([r["shortfall_mw"] for r in sub], dtype=float)

                daily_timeline.append(
                    DailyTimelinePoint(
                        date=d,
                        mae_mw=round(float(np.mean(np.abs(sub_err))), 1),
                        rmse_mw=round(float(np.sqrt(np.mean(sub_err**2))), 1),
                        mbe_mw=round(float(np.mean(sub_err)), 1),
                        mean_forecast_mw=round(float(np.mean(sub_for)), 1),
                        mean_actual_mw=round(float(np.mean(sub_act)), 1),
                        peak_shortfall_mw=round(float(np.max(sub_short)), 1),
                    )
                )

        # 4. Error Distribution Histogram (20 bins)
        min_err = float(np.min(signed_errors))
        max_err = float(np.max(signed_errors))
        num_bins = 20
        hist_counts, bin_edges = np.histogram(signed_errors, bins=num_bins)
        error_histogram: List[HistogramBin] = []
        for i in range(len(hist_counts)):
            b_start = round(float(bin_edges[i]), 0)
            b_end = round(float(bin_edges[i + 1]), 0)
            label = f"{int(b_start):+d} to {int(b_end):+d} MW"
            error_histogram.append(
                HistogramBin(
                    bin_start_mw=b_start,
                    bin_end_mw=b_end,
                    bin_label=label,
                    frequency=int(hist_counts[i]),
                )
            )

        # 5. Top 5 Worst Shortfalls
        sorted_by_shortfall = sorted(aligned, key=lambda x: x["shortfall_mw"], reverse=True)
        top_worst: List[WorstShortfall] = []
        for rank, r in enumerate(sorted_by_shortfall[:5], 1):
            top_worst.append(
                WorstShortfall(
                    rank=rank,
                    date=r["delivery_date"],
                    settlement_period=r["settlement_period"],
                    start_time_utc=r["start_time_utc"],
                    forecast_mw=round(r["forecast_mw"], 1),
                    actual_mw=round(r["actual_mw"], 1),
                    shortfall_mw=round(r["shortfall_mw"], 1),
                    lead_time_hours=r["lead_time_hours"],
                )
            )

        return AccuracyAuditResponse(
            evaluation_scope=scope,
            gate_closure=gate_closure,
            interpolation=interpolation,
            sample_count=n,
            global_metrics=global_metrics,
            error_by_horizon=error_by_horizon,
            diurnal_by_settlement_period=diurnal_list,
            daily_timeline=daily_timeline,
            error_histogram=error_histogram,
            top_worst_shortfalls=top_worst,
        )

    def generate_forecast_evolution(self, start_time_utc: str) -> ForecastEvolutionResponse:
        """Return historical progression of all forecasts targeting `start_time_utc`."""
        all_forecasts = self.manager.get_all_forecasts_for_target(start_time_utc)
        actual = self.manager.get_actual_by_start_time(start_time_utc)

        # Parse settlement date and period from start_time_utc
        dt = datetime.fromisoformat(start_time_utc.replace("Z", "+00:00"))
        settlement_date = dt.strftime("%Y-%m-%d")
        sp = (dt.hour * 2) + (1 if dt.minute == 0 else 2)

        runs: List[EvolutionRunPoint] = []
        for f in all_forecasts:
            p_time = f["publishTime"]
            f_mw = float(f["generation"])
            lead = compute_lead_time_hours(start_time_utc, p_time)
            err = round(f_mw - actual, 1) if actual is not None else None
            shortfall = max(0.0, err) if err is not None else None

            runs.append(
                EvolutionRunPoint(
                    publish_time_utc=p_time,
                    lead_time_hours=lead,
                    forecast_mw=f_mw,
                    signed_error_mw=err,
                    shortfall_mw=shortfall,
                )
            )

        # Sort runs chronologically by publish time
        runs.sort(key=lambda x: x.publish_time_utc)

        return ForecastEvolutionResponse(
            target_start_time_utc=start_time_utc,
            settlement_date=settlement_date,
            settlement_period=sp,
            actual_mw=actual,
            runs=runs,
        )


# Global singleton engine instance
engine = AlgorithmicEngine()
