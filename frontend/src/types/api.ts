export type GateClosure = '09:20' | '09:50' | '15:30';
export type EvaluationScope = 'delivery_jan' | 'decision_jan';
export type InterpolationMode = 'linear' | 'exact';

export interface SettlementPeriodRow {
  settlement_period: number;
  start_time_utc: string;
  forecast_mw: number;
  firm_wind_mw: number;
  upper_band_mw: number;
  actual_mw: number | null;
  demand_mw: number;
  naive_thermal_mw: number;
  recommended_thermal_mw: number;
  shortfall_buffer_mw: number;
  signed_error_mw: number | null;
  lead_time_hours: number;
  publish_time_used: string;
}

export interface TradingDeskKPIs {
  expected_wind_energy_mwh: number;
  firm_wind_energy_mwh: number;
  total_demand_energy_mwh: number;
  naive_thermal_mwh: number;
  recommended_thermal_mwh: number;
  shortfall_buffer_mwh: number;
  actual_wind_energy_mwh: number | null;
  imbalance_savings_estimate_gbp: number | null;
}

export interface TradingDeskResponse {
  delivery_date: string;
  gate_closure: GateClosure;
  decision_cutoff_utc: string;
  selected_publish_time_utc: string;
  confidence_level: number;
  demand_mw: number;
  interpolation: InterpolationMode;
  kpis: TradingDeskKPIs;
  periods: SettlementPeriodRow[];
}

export interface GlobalMetrics {
  mae_mw: number;
  rmse_mw: number;
  mbe_mw: number;
  mape_pct: number;
  nmae_pct: number;
  p10_shortfall_mw: number;
  p50_shortfall_mw: number;
  p75_shortfall_mw: number;
  p90_shortfall_mw: number;
  p95_shortfall_mw: number;
  max_shortfall_mw: number;
  max_surplus_mw: number;
  mean_lead_time_hours: number;
}

export interface HorizonError {
  horizon_bucket: string;
  sample_count: number;
  mae_mw: number;
  rmse_mw: number;
  mbe_mw: number;
}

export interface DiurnalPeriod {
  settlement_period: number;
  time_label: string;
  mae_mw: number;
  rmse_mw: number;
  mbe_mw: number;
  p90_shortfall_mw: number;
  mean_actual_mw: number;
  mean_forecast_mw: number;
}

export interface DailyTimelinePoint {
  date: string;
  mae_mw: number;
  rmse_mw: number;
  mbe_mw: number;
  mean_forecast_mw: number;
  mean_actual_mw: number;
  peak_shortfall_mw: number;
}

export interface HistogramBin {
  bin_start_mw: number;
  bin_end_mw: number;
  bin_label: string;
  frequency: number;
}

export interface WorstShortfall {
  rank: number;
  date: string;
  settlement_period: number;
  start_time_utc: string;
  forecast_mw: number;
  actual_mw: number;
  shortfall_mw: number;
  lead_time_hours: number;
}

export interface AccuracyAuditResponse {
  evaluation_scope: EvaluationScope;
  gate_closure: GateClosure;
  interpolation: InterpolationMode;
  sample_count: number;
  global_metrics: GlobalMetrics;
  error_by_horizon: HorizonError[];
  diurnal_by_settlement_period: DiurnalPeriod[];
  daily_timeline: DailyTimelinePoint[];
  error_histogram: HistogramBin[];
  top_worst_shortfalls: WorstShortfall[];
}

export interface EvolutionRunPoint {
  publish_time_utc: string;
  lead_time_hours: number;
  forecast_mw: number;
  signed_error_mw: number | null;
  shortfall_mw: number | null;
}

export interface ForecastEvolutionResponse {
  target_start_time_utc: string;
  settlement_date: string;
  settlement_period: number;
  actual_mw: number | null;
  runs: EvolutionRunPoint[];
}

export interface LiveVerifyResponse {
  status: string;
  timestamp_utc: string;
  latency_ms: number;
  endpoint_tested: string;
  sample_record: Record<string, unknown> | null;
  is_live: boolean;
}
