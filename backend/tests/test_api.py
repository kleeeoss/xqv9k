"""Integration tests for FastAPI endpoints."""

from pathlib import Path
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from backend.main import app

FRONTEND_INDEX_HTML = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist" / "index.html"


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)


def test_health_endpoint(client: TestClient):
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "online"
    assert data["data_loaded"] is True
    assert data["fuelhh_records"] > 1400


def test_trading_desk_endpoint(client: TestClient):
    r = client.get("/api/trading-desk?delivery_date=2026-01-02&gate_closure=09:20&confidence_level=0.90")
    assert r.status_code == 200
    data = r.json()
    assert data["delivery_date"] == "2026-01-02"
    assert data["gate_closure"] == "09:20"
    assert len(data["periods"]) == 48
    assert data["kpis"]["expected_wind_energy_mwh"] > 0
    assert data["kpis"]["firm_wind_energy_mwh"] > 0


def test_trading_desk_exact_resolution(client: TestClient):
    r = client.get("/api/trading-desk?delivery_date=2026-01-02&interpolation=exact")
    assert r.status_code == 200
    data = r.json()
    # In exact mode, only 24 hourly periods are returned
    assert len(data["periods"]) == 24


def test_trading_desk_rejects_out_of_scope_dates(client: TestClient):
    """Verifies that delivery dates outside January 1–31, 2026 are strictly rejected with HTTP 400."""
    invalid_dates = [
        "2026-02-01",  # February 1st
        "2026-02-15",  # Mid-February
        "2025-12-31",  # December 31st
        "2025-01-15",  # Wrong year
        "2026-01-00",  # Invalid day
        "2026-01-32",  # Invalid day
        "not-a-date",  # Malformed
        "",            # Empty
    ]
    for bad_date in invalid_dates:
        r = client.get(f"/api/trading-desk?delivery_date={bad_date}")
        assert r.status_code == 400, f"Expected 400 for delivery_date='{bad_date}', got {r.status_code}"
        assert "detail" in r.json()


def test_trading_desk_accepts_valid_january_boundary_dates(client: TestClient):
    """Verifies that start, mid, and end dates of January 2026 are accepted."""
    for valid_date in ["2026-01-01", "2026-01-15", "2026-01-31"]:
        r = client.get(f"/api/trading-desk?delivery_date={valid_date}")
        assert r.status_code == 200, f"Expected 200 for valid date '{valid_date}', got {r.status_code}"
        data = r.json()
        assert data["delivery_date"] == valid_date
        assert len(data["periods"]) == 48


def test_trading_desk_confidence_level_parameter_propagation(client: TestClient):
    """Verifies that selecting P50, P75, P90, P95 monotonically adjusts Firm Wind and Thermal Procurement."""
    confidences = [0.50, 0.75, 0.90, 0.95]
    firm_wind_totals = []
    rec_thermal_totals = []

    for conf in confidences:
        r = client.get(f"/api/trading-desk?delivery_date=2026-01-02&confidence_level={conf}")
        assert r.status_code == 200
        data = r.json()
        assert data["confidence_level"] == conf
        firm_wind_totals.append(data["kpis"]["firm_wind_energy_mwh"])
        rec_thermal_totals.append(data["kpis"]["recommended_thermal_mwh"])

    # Firm wind floor must decrease (or stay equal) as risk confidence increases (higher shortfall hedge)
    for i in range(len(firm_wind_totals) - 1):
        assert firm_wind_totals[i] >= firm_wind_totals[i + 1], (
            f"Firm wind should decrease with higher confidence: P{int(confidences[i]*100)} ({firm_wind_totals[i]}) "
            f"vs P{int(confidences[i+1]*100)} ({firm_wind_totals[i+1]})"
        )
        assert rec_thermal_totals[i] <= rec_thermal_totals[i + 1], (
            f"Recommended thermal should increase with higher confidence: P{int(confidences[i]*100)} ({rec_thermal_totals[i]}) "
            f"vs P{int(confidences[i+1]*100)} ({rec_thermal_totals[i+1]})"
        )


def test_accuracy_audit_endpoint(client: TestClient):
    r = client.get("/api/accuracy-audit?gate_closure=09:20&scope=delivery_jan")
    assert r.status_code == 200
    data = r.json()
    assert data["sample_count"] == 1488
    assert data["global_metrics"]["mae_mw"] > 1000
    assert len(data["top_worst_shortfalls"]) == 5


def test_forecast_evolution_endpoint(client: TestClient):
    r = client.get("/api/forecast-evolution?start_time=2026-01-02T19:00:00Z")
    assert r.status_code == 200
    data = r.json()
    assert data["target_start_time_utc"] == "2026-01-02T19:00:00Z"
    assert len(data["runs"]) > 0


def test_forecast_evolution_half_hour_endpoint(client: TestClient):
    """Verifies that drilldown on half-hourly settlement periods (e.g. Rank 3 SP 4) works via HTTP."""
    r = client.get("/api/forecast-evolution?start_time=2026-01-12T01:30:00Z")
    assert r.status_code == 200
    data = r.json()
    assert data["target_start_time_utc"] == "2026-01-12T01:30:00Z"
    assert data["settlement_period"] == 4
    assert len(data["runs"]) >= 10


def test_live_verify_mocked_offline(client: TestClient):
    """Verifies that live-verify endpoint responds cleanly even when mocked offline."""
    mock_response = {
        "dataset": "FUELHH",
        "publishTime": "2026-01-02T00:00:00Z",
        "startTime": "2026-01-01T23:30:00Z",
        "settlementDate": "2026-01-01",
        "settlementPeriod": 48,
        "fuelType": "WIND",
        "generation": 15538,
    }
    with patch("requests.get") as mock_get:
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = [mock_response]
        r = client.get("/api/elexon/live-verify")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "healthy"
        assert data["is_live"] is True
        assert data["sample_record"]["generation"] == 15538


@pytest.mark.skipif(
    not FRONTEND_INDEX_HTML.exists(),
    reason="Frontend dist/index.html not compiled yet; verified in docker-smoke and e2e stages",
)
def test_spa_root_serves_html(client: TestClient):
    r = client.get("/")
    assert r.status_code == 200
    assert "<!DOCTYPE html>" in r.text or "root" in r.text
