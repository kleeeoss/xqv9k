"""Integration tests for FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient
from backend.main import app


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


def test_spa_root_serves_html(client: TestClient):
    r = client.get("/")
    assert r.status_code == 200
    assert "<!DOCTYPE html>" in r.text or "root" in r.text
