import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TradingDeskTab } from '../components/TradingDeskTab';
import * as apiClient from '../services/apiClient';
import { TradingDeskResponse } from '../types/api';

const mockResponse: TradingDeskResponse = {
  delivery_date: '2026-01-02',
  gate_closure: '09:20',
  decision_cutoff_utc: '2026-01-01T09:20:00Z',
  selected_publish_time_utc: '2026-01-01T07:30:00Z',
  confidence_level: 0.90,
  demand_mw: 22000.0,
  interpolation: 'linear',
  kpis: {
    expected_wind_energy_mwh: 438593.0,
    firm_wind_energy_mwh: 335030.6,
    total_demand_energy_mwh: 528000.0,
    naive_thermal_mwh: 89407.0,
    recommended_thermal_mwh: 192969.4,
    shortfall_buffer_mwh: 103562.4,
    actual_wind_energy_mwh: 351408.0,
    imbalance_savings_estimate_gbp: 642810.0,
  },
  periods: [
    {
      settlement_period: 1,
      start_time_utc: '2026-01-02T00:00:00Z',
      forecast_mw: 18200.0,
      firm_wind_mw: 14000.0,
      upper_band_mw: 19000.0,
      actual_mw: 15000.0,
      demand_mw: 22000.0,
      naive_thermal_mw: 3800.0,
      recommended_thermal_mw: 8000.0,
      shortfall_buffer_mw: 4200.0,
      signed_error_mw: 3200.0,
      lead_time_hours: 16.5,
      publish_time_used: '2026-01-01T07:30:00Z',
    },
  ],
};

describe('TradingDeskTab Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches trading desk data and updates Firm Wind title dynamically on P50/P75/P90/P95 selection', async () => {
    const fetchSpy = vi.spyOn(apiClient, 'fetchTradingDesk').mockResolvedValue(mockResponse);

    render(
      <TradingDeskTab
        gateClosure="09:20"
        scope="delivery_jan"
        interpolation="linear"
      />
    );

    // Initial loading state
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();

    // Data resolves
    await waitFor(() => {
      expect(screen.getByText('Expected Wind')).toBeInTheDocument();
    });

    // Default confidence is P90
    expect(screen.getByText('Firm Wind (P90)')).toBeInTheDocument();
    expect(screen.getByText('P90 Renewable Floor')).toBeInTheDocument();

    // Select P50
    const p50Btn = screen.getByTestId('confidence-btn-50');
    fireEvent.click(p50Btn);

    await waitFor(() => {
      expect(screen.getByText('Firm Wind (P50)')).toBeInTheDocument();
      expect(screen.getByText('P50 Renewable Floor')).toBeInTheDocument();
    });

    // Select P75
    const p75Btn = screen.getByTestId('confidence-btn-75');
    fireEvent.click(p75Btn);

    await waitFor(() => {
      expect(screen.getByText('Firm Wind (P75)')).toBeInTheDocument();
      expect(screen.getByText('P75 Renewable Floor')).toBeInTheDocument();
    });

    // Select P95
    const p95Btn = screen.getByTestId('confidence-btn-95');
    fireEvent.click(p95Btn);

    await waitFor(() => {
      expect(screen.getByText('Firm Wind (P95)')).toBeInTheDocument();
      expect(screen.getByText('P95 Renewable Floor')).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalled();
  });

  it('renders outturn toggle and toggles visibility label', async () => {
    vi.spyOn(apiClient, 'fetchTradingDesk').mockResolvedValue(mockResponse);

    render(
      <TradingDeskTab
        gateClosure="09:20"
        scope="delivery_jan"
        interpolation="linear"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('toggle-actuals-btn')).toBeInTheDocument();
    });

    const toggleBtn = screen.getByTestId('toggle-actuals-btn');
    expect(toggleBtn).toHaveTextContent('Hide Outturn');

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent('Show Outturn');
  });

  it('displays user-friendly error state on API failure', async () => {
    vi.spyOn(apiClient, 'fetchTradingDesk').mockRejectedValue(new Error('Network error: Failed to connect to server'));

    render(
      <TradingDeskTab
        gateClosure="09:20"
        scope="delivery_jan"
        interpolation="linear"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.getByText(/Network error: Failed to connect to server/i)).toBeInTheDocument();
    });
  });
});
