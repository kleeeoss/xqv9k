import {
  AccuracyAuditResponse,
  EvaluationScope,
  ForecastEvolutionResponse,
  GateClosure,
  InterpolationMode,
  LiveVerifyResponse,
  TradingDeskResponse,
} from '../types/api';

const BASE_URL = '';

export async function fetchTradingDesk(params: {
  delivery_date: string;
  gate_closure: GateClosure;
  confidence_level: number;
  demand_mw: number;
  scope: EvaluationScope;
  interpolation: InterpolationMode;
}): Promise<TradingDeskResponse> {
  const query = new URLSearchParams({
    delivery_date: params.delivery_date,
    gate_closure: params.gate_closure,
    confidence_level: params.confidence_level.toString(),
    demand_mw: params.demand_mw.toString(),
    scope: params.scope,
    interpolation: params.interpolation,
  });

  const res = await fetch(`${BASE_URL}/api/trading-desk?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Trading Desk fetch failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAccuracyAudit(params: {
  gate_closure: GateClosure;
  scope: EvaluationScope;
  interpolation: InterpolationMode;
}): Promise<AccuracyAuditResponse> {
  const query = new URLSearchParams({
    gate_closure: params.gate_closure,
    scope: params.scope,
    interpolation: params.interpolation,
  });

  const res = await fetch(`${BASE_URL}/api/accuracy-audit?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Accuracy Audit fetch failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchForecastEvolution(startTimeUtc: string): Promise<ForecastEvolutionResponse> {
  const query = new URLSearchParams({
    start_time: startTimeUtc,
  });

  const res = await fetch(`${BASE_URL}/api/forecast-evolution?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Forecast Evolution fetch failed: ${res.statusText}`);
  }
  return res.json();
}

export async function verifyElexonLive(): Promise<LiveVerifyResponse> {
  const res = await fetch(`${BASE_URL}/api/elexon/live-verify`);
  if (!res.ok) {
    throw new Error(`Live verify failed: ${res.statusText}`);
  }
  return res.json();
}
