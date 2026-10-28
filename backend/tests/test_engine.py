"""Pytest test suite for Gridbricks Algorithmic Engine.

Strictly verifies:
1. Zero lookahead bias (rejects future runs: publishTime > T_cutoff)
2. Resolution alignment (exact hourly vs linear half-hourly interpolation)
3. Quantile and Firm Wind properties (W_firm <= W_hat, Delta P_buffer >= 0)
4. Thermal accounting balance (W_firm + P_rec >= Demand)
5. Synthetic math correctness and Jan 2 empirical shortfall identification
"""

from __future__ import annotations

import math
import pytest
import numpy as np
from datetime import datetime

from backend.elexon_client import ElexonDataManager
from backend.engine import (
    AlgorithmicEngine,
    compute_decision_cutoff,
    compute_lead_time_hours,
    get_half_hour_timestamp,
)


@pytest.fixture(scope="session")
def loaded_engine() -> AlgorithmicEngine:
    manager = ElexonDataManager()
    assert manager.is_loaded, "Elexon snapshot data must be loaded"
    return AlgorithmicEngine(manager=manager)


class TestAlgorithmicCausality:
    """Verifies zero lookahead bias and point-in-time causality."""

    def test_decision_cutoff_calculation(self):
        cutoff = compute_decision_cutoff("2026-01-02", "09:20")
        assert cutoff == "2026-01-01T09:20:00Z"

        cutoff_n2ex = compute_decision_cutoff("2026-01-15", "09:50")
        assert cutoff_n2ex == "2026-01-14T09:50:00Z"

        cutoff_hh = compute_decision_cutoff("2026-01-31", "15:30")
        assert cutoff_hh == "2026-01-30T15:30:00Z"

    def test_zero_lookahead_rejects_future_runs(self, loaded_engine: AlgorithmicEngine):
        """EPEX auction at 09:20 UTC on 2026-01-01 must select 07:30 UTC run,

        rejecting the 09:30 UTC and 11:30 UTC runs which were published post-gate.
        """
        cutoff = "2026-01-01T09:20:00Z"
        selected_run = loaded_engine.manager.get_latest_publish_time_before(cutoff)

        assert selected_run is not None
        assert selected_run <= cutoff, f"Run {selected_run} exceeds cutoff {cutoff}"
        assert selected_run == "2026-01-01T07:30:00Z"

        # Explicitly verify that 09:30 run is rejected
        all_runs = loaded_engine.manager.unique_publish_times
        post_gate_runs = [r for r in all_runs if r > cutoff]
        assert "2026-01-01T09:30:00Z" in post_gate_runs
        assert selected_run not in post_gate_runs

    def test_injected_future_forecast_is_strictly_ignored(self):
        """Synthetic causality test: inject a future forecast and assert it is never chosen."""
        mock_manager = ElexonDataManager()
        mock_manager.unique_publish_times = [
            "2026-01-01T02:30:00Z",
            "2026-01-01T04:30:00Z",
            "2026-01-01T07:30:00Z",
            "2026-01-01T09:25:00Z",  # 5 minutes past 09:20 gate
            "2026-01-01T09:30:00Z",
        ]
        cutoff = "2026-01-01T09:20:00Z"
        selected = mock_manager.get_latest_publish_time_before(cutoff)
        assert selected == "2026-01-01T07:30:00Z"
        assert selected != "2026-01-01T09:25:00Z"


class TestResolutionAlignment:
    """Verifies exact hourly matching and linear half-hourly interpolation."""

    def test_linear_interpolation_arithmetic_mean(self, loaded_engine: AlgorithmicEngine):
        """For SP 2 (00:30 UTC), forecast should be average of SP 1 (00:00) and SP 3 (01:00)."""
        pub_time = "2026-01-01T07:30:00Z"
        t_sp1 = "2026-01-02T00:00:00Z"
        t_sp2 = "2026-01-02T00:30:00Z"
        t_sp3 = "2026-01-02T01:00:00Z"

        gen_sp1 = loaded_engine.manager.get_forecast_generation(pub_time, t_sp1)
        gen_sp3 = loaded_engine.manager.get_forecast_generation(pub_time, t_sp3)
        gen_sp2 = loaded_engine.interpolate_forecast(pub_time, t_sp2, interpolation="linear")

        assert gen_sp1 is not None and gen_sp3 is not None and gen_sp2 is not None
        expected_sp2 = round((gen_sp1 + gen_sp3) / 2.0, 1)
        assert gen_sp2 == expected_sp2

    def test_exact_resolution_omits_interpolated_half_hours(self, loaded_engine: AlgorithmicEngine):
        """In exact mode, interpolate_forecast on :30 returns None."""
        pub_time = "2026-01-01T07:30:00Z"
        t_sp2 = "2026-01-02T00:30:00Z"
        val = loaded_engine.interpolate_forecast(pub_time, t_sp2, interpolation="exact")
        assert val is None

        # But exact on the hour returns value
        t_sp1 = "2026-01-02T00:00:00Z"
        val_sp1 = loaded_engine.interpolate_forecast(pub_time, t_sp1, interpolation="exact")
        assert val_sp1 is not None


class TestQuantilesAndFirmWindProperties:
    """Verifies mathematical invariants:

    W_firm <= W_hat
    Delta P_buffer >= 0
    P_rec >= P_naive
    """

    def test_firm_wind_and_buffer_invariants(self, loaded_engine: AlgorithmicEngine):
        for conf in [0.50, 0.75, 0.90, 0.95]:
            desk = loaded_engine.generate_trading_desk_view(
                delivery_date="2026-01-02",
                gate_closure="09:20",
                confidence_level=conf,
                demand_mw=22000.0,
            )

            assert len(desk.periods) == 48

            for period in desk.periods:
                # 1. Firm wind cannot exceed raw forecast
                assert period.firm_wind_mw <= period.forecast_mw + 1e-6, (
                    f"SP {period.settlement_period}: W_firm ({period.firm_wind_mw}) > W_hat ({period.forecast_mw})"
                )
                # 2. Firm wind is non-negative
                assert period.firm_wind_mw >= 0.0

                # 3. Recommended thermal is at least naive thermal
                assert period.recommended_thermal_mw >= period.naive_thermal_mw - 1e-6, (
                    f"SP {period.settlement_period}: P_rec ({period.recommended_thermal_mw}) < P_naive ({period.naive_thermal_mw})"
                )

                # 4. Uncertainty reserve buffer is non-negative
                assert period.shortfall_buffer_mw >= -1e-6, (
                    f"SP {period.settlement_period}: Delta P_buffer ({period.shortfall_buffer_mw}) < 0"
                )


class TestThermalAccountingBalance:
    """Verifies that total supply satisfies total demand under both procurement models:

    W_firm + P_rec >= Demand
    W_hat + P_naive >= Demand
    """

    def test_accounting_balance_across_all_periods(self, loaded_engine: AlgorithmicEngine):
        desk = loaded_engine.generate_trading_desk_view(
            delivery_date="2026-01-15",
            gate_closure="09:20",
            confidence_level=0.90,
            demand_mw=25000.0,
        )

        for period in desk.periods:
            firm_plus_thermal = period.firm_wind_mw + period.recommended_thermal_mw
            assert firm_plus_thermal >= period.demand_mw - 1e-4, (
                f"Balance deficit at SP {period.settlement_period}: {firm_plus_thermal} < {period.demand_mw}"
            )

            naive_plus_forecast = period.forecast_mw + period.naive_thermal_mw
            assert naive_plus_forecast >= period.demand_mw - 1e-4, (
                f"Naive deficit at SP {period.settlement_period}: {naive_plus_forecast} < {period.demand_mw}"
            )


class TestEmpiricalJanuaryShortfallEvent:
    """Verifies that the empirical January 2, 2026 evening shortfall is correctly identified."""

    def test_jan_2_evening_shortfall(self, loaded_engine: AlgorithmicEngine):
        desk = loaded_engine.generate_trading_desk_view(
            delivery_date="2026-01-02",
            gate_closure="09:20",
            confidence_level=0.90,
        )

        # SP 46 (22:30 UTC): Forecast ~18,293 MW, Actual ~13,958 MW -> Shortfall ~4,335 MW
        sp46 = next(p for p in desk.periods if p.settlement_period == 46)
        assert sp46.actual_mw is not None
        shortfall = sp46.forecast_mw - sp46.actual_mw
        assert shortfall > 4000.0, f"Expected >4000 MW shortfall in SP 46, got {shortfall}"

        # Verify savings estimate is positive
        assert desk.kpis.imbalance_savings_estimate_gbp is not None
        assert desk.kpis.imbalance_savings_estimate_gbp > 500000.0


class TestAccuracyAuditMetrics:
    """Verifies comprehensive accuracy audit calculations and KPI consistency."""

    def test_audit_kpis_and_sample_count(self, loaded_engine: AlgorithmicEngine):
        audit = loaded_engine.generate_accuracy_audit_view(
            gate_closure="09:20",
            scope="delivery_jan",
            interpolation="linear",
        )

        assert audit.sample_count == 1488  # 31 days * 48 periods = 1488
        assert audit.global_metrics.mae_mw > 0
        assert audit.global_metrics.rmse_mw >= audit.global_metrics.mae_mw  # Jensen's inequality
        assert audit.global_metrics.p95_shortfall_mw >= audit.global_metrics.p90_shortfall_mw
        assert audit.global_metrics.p90_shortfall_mw >= audit.global_metrics.p50_shortfall_mw
        assert len(audit.error_by_horizon) > 0
        assert len(audit.diurnal_by_settlement_period) == 48
        assert len(audit.daily_timeline) == 31
        assert len(audit.top_worst_shortfalls) == 5

    def test_decision_scope_evaluation(self, loaded_engine: AlgorithmicEngine):
        """Scope 'decision_jan' covers decisions Jan 1-31 (deliveries Jan 2 to Feb 1)."""
        audit = loaded_engine.generate_accuracy_audit_view(
            gate_closure="09:20",
            scope="decision_jan",
            interpolation="linear",
        )
        assert audit.sample_count == 1488
        assert len(audit.daily_timeline) == 31
        assert audit.daily_timeline[0].date == "2026-01-02"
        assert audit.daily_timeline[-1].date == "2026-02-01"


class TestExtremeEventsAndEvolution:
    """Verifies Jan 8 wind drought, Jan 27 storm peak, and forecast evolution cone."""

    def test_jan_8_wind_drought(self, loaded_engine: AlgorithmicEngine):
        desk = loaded_engine.generate_trading_desk_view(
            delivery_date="2026-01-08",
            gate_closure="09:20",
            confidence_level=0.90,
            demand_mw=22000.0,
        )
        # Low wind day: firm wind should be very low and recommended thermal high
        assert desk.kpis.firm_wind_energy_mwh < desk.kpis.recommended_thermal_mwh
        assert desk.kpis.recommended_thermal_mwh > 200000.0

    def test_jan_27_storm_peak(self, loaded_engine: AlgorithmicEngine):
        desk = loaded_engine.generate_trading_desk_view(
            delivery_date="2026-01-27",
            gate_closure="09:20",
            confidence_level=0.90,
        )
        # High wind day: expected wind is massive
        assert desk.kpis.expected_wind_energy_mwh > 300000.0

    def test_forecast_evolution_cone(self, loaded_engine: AlgorithmicEngine):
        target = "2026-01-02T19:00:00Z"
        evolution = loaded_engine.generate_forecast_evolution(target)
        assert evolution.target_start_time_utc == target
        assert evolution.settlement_date == "2026-01-02"
        assert evolution.settlement_period == 39
        assert evolution.actual_mw is not None
        assert len(evolution.runs) >= 4  # multiple runs published leading up to delivery
        # Verify runs are sorted chronologically
        for i in range(len(evolution.runs) - 1):
            assert evolution.runs[i].publish_time_utc <= evolution.runs[i + 1].publish_time_utc
            assert evolution.runs[i].lead_time_hours >= evolution.runs[i + 1].lead_time_hours

    def test_confidence_level_monotonicity(self, loaded_engine: AlgorithmicEngine):
        """Higher confidence level alpha requires larger buffer, lowering firm wind."""
        d50 = loaded_engine.generate_trading_desk_view("2026-01-02", confidence_level=0.50)
        d90 = loaded_engine.generate_trading_desk_view("2026-01-02", confidence_level=0.90)
        d95 = loaded_engine.generate_trading_desk_view("2026-01-02", confidence_level=0.95)

        assert d50.kpis.firm_wind_energy_mwh >= d90.kpis.firm_wind_energy_mwh
        assert d90.kpis.firm_wind_energy_mwh >= d95.kpis.firm_wind_energy_mwh
        assert d50.kpis.shortfall_buffer_mwh <= d90.kpis.shortfall_buffer_mwh
        assert d90.kpis.shortfall_buffer_mwh <= d95.kpis.shortfall_buffer_mwh
