import React, { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Flame,
  Shield,
  Sliders,
  Wind,
  Zap,
} from 'lucide-react';
import {
  EvaluationScope,
  GateClosure,
  InterpolationMode,
  TradingDeskResponse,
} from '../types/api';
import { fetchTradingDesk } from '../services/apiClient';
import { MetricCard } from './MetricCard';

interface TradingDeskTabProps {
  gateClosure: GateClosure;
  scope: EvaluationScope;
  interpolation: InterpolationMode;
  onOpenEvolution?: (startTimeUtc: string) => void;
}

const PRESETS = [
  { label: 'Jan 2 Shortfall (+4,335 MW)', date: '2026-01-02', color: 'border-rose-500/40 text-rose-400 bg-rose-500/10' },
  { label: 'Jan 8 Drought (4,528 MW)', date: '2026-01-08', color: 'border-amber-500/40 text-amber-400 bg-amber-500/10' },
  { label: 'Jan 27 Storm (17,805 MW)', date: '2026-01-27', color: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10' },
  { label: 'Jan 15 Mid-Month', date: '2026-01-15', color: 'border-slate-600 text-slate-300 bg-obsidian-800' },
];

export const TradingDeskTab: React.FC<TradingDeskTabProps> = ({
  gateClosure,
  scope,
  interpolation,
  onOpenEvolution,
}) => {
  const [deliveryDate, setDeliveryDate] = useState('2026-01-02');
  const [confidenceLevel, setConfidenceLevel] = useState(0.90);
  const [demandMw, setDemandMw] = useState(22000.0);
  const [showActuals, setShowActuals] = useState(true);

  const [data, setData] = useState<TradingDeskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchTradingDesk({
      delivery_date: deliveryDate,
      gate_closure: gateClosure,
      confidence_level: confidenceLevel,
      demand_mw: demandMw,
      scope,
      interpolation,
    })
      .then((res) => {
        if (isMounted) setData(res);
      })
      .catch((err) => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [deliveryDate, gateClosure, confidenceLevel, demandMw, scope, interpolation]);

  const handleExportCSV = () => {
    if (!data) return;
    const headers = [
      'SettlementPeriod',
      'StartTimeUTC',
      'PublishTimeUsed',
      'LeadTimeHours',
      'ForecastMW',
      'FirmWindMW',
      'DemandMW',
      'NaiveThermalMW',
      'RecommendedThermalMW',
      'ShortfallBufferMW',
      'ActualMW',
      'SignedErrorMW',
    ];

    const rows = data.periods.map((p) => [
      p.settlement_period,
      p.start_time_utc,
      p.publish_time_used,
      p.lead_time_hours,
      p.forecast_mw,
      p.firm_wind_mw,
      p.demand_mw,
      p.naive_thermal_mw,
      p.recommended_thermal_mw,
      p.shortfall_buffer_mw,
      p.actual_mw ?? '',
      p.signed_error_mw ?? '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `gridbricks_dispatch_${deliveryDate}_${gateClosure.replace(':', '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const chartData = data?.periods.map((p) => {
    const timeLabel = p.start_time_utc.slice(11, 16);
    return {
      sp: `SP${p.settlement_period}`,
      time: timeLabel,
      fullTime: p.start_time_utc,
      forecast: p.forecast_mw,
      firmWind: p.firm_wind_mw,
      upperBand: p.upper_band_mw,
      bandDelta: Math.max(0, p.upper_band_mw - p.firm_wind_mw),
      actual: p.actual_mw,
      demand: p.demand_mw,
      naiveThermal: p.naive_thermal_mw,
      recThermal: p.recommended_thermal_mw,
      buffer: p.shortfall_buffer_mw,
      signedError: p.signed_error_mw,
    };
  }) ?? [];

  return (
    <div className="space-y-6">
      {/* Interactive Control Panel & Presets */}
      <div className="rounded-2xl bg-obsidian-900 border border-obsidian-700/80 p-4 lg:p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Date Picker & Presets */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>Delivery Date (January 2026)</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                min="2026-01-01"
                max="2026-02-01"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="bg-obsidian-950 border border-obsidian-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 shadow"
              />
              <div className="hidden sm:flex items-center space-x-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.date}
                    type="button"
                    onClick={() => setDeliveryDate(p.date)}
                    className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-all ${
                      deliveryDate === p.date
                        ? `${p.color} ring-1 ring-cyan-500/40 font-bold`
                        : 'border-obsidian-800 text-slate-400 hover:text-slate-200 hover:border-obsidian-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Confidence Quantile Selector */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Firm Wind Shortfall Confidence (P_alpha)</span>
            </label>
            <div className="flex items-center bg-obsidian-950 border border-obsidian-700 rounded-lg p-1 space-x-1">
              {[
                { label: 'P50 (Neutral)', val: 0.50 },
                { label: 'P75 (Moderate)', val: 0.75 },
                { label: 'P90 (Prudent)', val: 0.90 },
                { label: 'P95 (Stress)', val: 0.95 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setConfidenceLevel(opt.val)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all ${
                    confidenceLevel === opt.val
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Portfolio Demand Slider */}
          <div className="space-y-2 min-w-[220px]">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 uppercase flex items-center space-x-1">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>Base Demand</span>
              </span>
              <span className="font-bold text-indigo-300">{demandMw.toLocaleString()} MW</span>
            </div>
            <input
              type="range"
              min="12000"
              max="32000"
              step="1000"
              value={demandMw}
              onChange={(e) => setDemandMw(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 bg-obsidian-950 cursor-pointer"
            />
          </div>
        </div>

        {/* Selected Run Causality Badge Strip */}
        {data && (
          <div className="mt-4 pt-3 border-t border-obsidian-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>
                Gate Cutoff:{' '}
                <strong className="text-slate-200">
                  {data.decision_cutoff_utc.replace('T', ' ').replace(':00Z', ' UTC')}
                </strong>
              </span>
              <span className="text-slate-600">|</span>
              <span>
                Latest Eligible Run:{' '}
                <strong className="text-cyan-400">
                  {data.selected_publish_time_utc.replace('T', ' ').replace(':00Z', ' UTC')}
                </strong>
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setShowActuals(!showActuals)}
                className="flex items-center space-x-1 text-slate-300 hover:text-white"
              >
                {showActuals ? <Eye className="w-3.5 h-3.5 text-amber-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                <span>{showActuals ? 'Hide Outturn' : 'Show Outturn'}</span>
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-obsidian-950 border border-obsidian-700 text-slate-300 hover:text-white hover:border-slate-500 shadow"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Loading or Error State */}
      {loading && (
        <div className="p-12 text-center font-mono text-cyan-400 animate-pulse">
          Evaluating Day-Ahead Causality & Shortfall Quantiles...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {data && !loading && (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard
              title="Expected Wind"
              value={data.kpis.expected_wind_energy_mwh}
              unit="MWh"
              subtitle="Sum of W_hat forecasts"
              formulaTooltip="Sum of Day-Ahead hourly/half-hourly wind forecasts across the delivery day."
              variant="cyan"
              icon={Wind}
            />
            <MetricCard
              title="Firm Wind (P90)"
              value={data.kpis.firm_wind_energy_mwh}
              unit="MWh"
              subtitle="Shortfall-hedged floor"
              formulaTooltip="W_firm = max(0, W_hat - Q_alpha(S)). Represents guaranteed renewable floor at confidence alpha."
              variant="emerald"
              icon={Shield}
            />
            <MetricCard
              title="Total Demand"
              value={data.kpis.total_demand_energy_mwh}
              unit="MWh"
              subtitle="Consumer portfolio volume"
              formulaTooltip="Sum of half-hourly consumer demand profile D(t) across all 48 settlement periods."
              variant="indigo"
              icon={Zap}
            />
            <MetricCard
              title="Naive Thermal"
              value={data.kpis.naive_thermal_mwh}
              unit="MWh"
              subtitle="Zero-buffer procurement"
              formulaTooltip="P_naive = max(0, D - W_hat). Unhedged thermal dispatch assuming zero wind forecast error."
              variant="slate"
              icon={Flame}
            />
            <MetricCard
              title="Rec. Thermal"
              value={data.kpis.recommended_thermal_mwh}
              unit="MWh"
              subtitle="Firm-wind dispatched"
              formulaTooltip="P_rec = max(0, D - W_firm). Dispatched thermal power ensuring firm demand coverage."
              variant="rose"
              icon={Flame}
            />
            <MetricCard
              title="Savings Hedged"
              value={
                data.kpis.imbalance_savings_estimate_gbp
                  ? `£${Math.round(data.kpis.imbalance_savings_estimate_gbp).toLocaleString()}`
                  : 'N/A'
              }
              subtitle="Avoided Cash-Out Penalty"
              formulaTooltip="Sum(min(Shortfall, Buffer) * 0.5h * Delta_SBP). Avoided Balancing Mechanism cash-out loss."
              variant="emerald"
              icon={CheckCircle2}
              badge="ROI"
            />
          </div>

          {/* Visual 1: Forecast Uncertainty Fan Chart */}
          <div className="rounded-2xl bg-obsidian-900 border border-obsidian-700/80 p-4 lg:p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-obsidian-800 gap-2">
              <div>
                <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider flex items-center space-x-2">
                  <Wind className="w-4 h-4 text-cyan-400" />
                  <span>Forecast Uncertainty Fan Chart (Delivery Day {data.delivery_date})</span>
                </h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  Point-in-Time NGESO Forecast vs Empirical Firm Wind Floor and Actual Outturn
                </p>
              </div>
              <div className="flex items-center space-x-3 text-xs font-mono">
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-1 bg-cyan-400 rounded-full" />
                  <span className="text-slate-300">Forecast W_hat</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-1 bg-emerald-400 rounded-full border border-dashed" />
                  <span className="text-slate-300">P90 Firm Wind</span>
                </span>
                {showActuals && (
                  <span className="flex items-center space-x-1.5">
                    <span className="w-3 h-1 bg-amber-400 rounded-full" />
                    <span className="text-slate-300">Actual Outturn</span>
                  </span>
                )}
              </div>
            </div>

            <div className="h-80 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fanGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                  <XAxis
                    dataKey="time"
                    stroke="#6B7280"
                    tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'monospace' }}
                    interval={3}
                  />
                  <YAxis
                    stroke="#6B7280"
                    tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'monospace' }}
                    domain={['auto', 'auto']}
                    unit=" MW"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0B0F19',
                      borderColor: '#374151',
                      borderRadius: '0.75rem',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                    }}
                  />
                  {/* Uncertainty Prediction Interval Band (stacked on firm wind floor) */}
                  <Area
                    type="monotone"
                    dataKey="firmWind"
                    stackId="uncertaintyBand"
                    stroke="none"
                    fill="transparent"
                    legendType="none"
                    tooltipType="none"
                  />
                  <Area
                    type="monotone"
                    dataKey="bandDelta"
                    stackId="uncertaintyBand"
                    stroke="none"
                    fill="#06B6D4"
                    fillOpacity={0.16}
                    name="P10–P90 Prediction Interval"
                  />
                  <Line
                    type="monotone"
                    dataKey="firmWind"
                    stroke="#10B981"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    name="P90 Firm Wind Floor"
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="#06B6D4"
                    strokeWidth={2.5}
                    dot={false}
                    name="Raw Forecast W_hat"
                  />
                  {showActuals && (
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      dot={{ r: 2, fill: '#F59E0B' }}
                      name="Actual Outturn (FUELHH)"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Visual 2: Day-Ahead Thermal Procurement Dispatch (Stacked Area) */}
          <div className="rounded-2xl bg-obsidian-900 border border-obsidian-700/80 p-4 lg:p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-obsidian-800 gap-2">
              <div>
                <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider flex items-center space-x-2">
                  <Flame className="w-4 h-4 text-rose-400" />
                  <span>Risk-Adjusted Day-Ahead Thermal Procurement Dispatch</span>
                </h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  How Expected Consumer Demand is balanced across Firm Wind, Naive Thermal, and Reserve Buffer
                </p>
              </div>
              <div className="flex items-center space-x-3 text-xs font-mono">
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-2 bg-emerald-500 rounded-sm" />
                  <span className="text-slate-300">Firm Wind</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-2 bg-slate-600 rounded-sm" />
                  <span className="text-slate-300">Base Thermal</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-2 bg-rose-500 rounded-sm" />
                  <span className="text-slate-300">Risk Buffer Delta_P</span>
                </span>
              </div>
            </div>

            <div className="h-80 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                  <XAxis
                    dataKey="time"
                    stroke="#6B7280"
                    tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'monospace' }}
                    interval={3}
                  />
                  <YAxis
                    stroke="#6B7280"
                    tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'monospace' }}
                    unit=" MW"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0B0F19',
                      borderColor: '#374151',
                      borderRadius: '0.75rem',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="firmWind"
                    stackId="1"
                    stroke="#10B981"
                    fill="#10B981"
                    fillOpacity={0.6}
                    name="Firm Wind MW"
                  />
                  <Area
                    type="monotone"
                    dataKey="naiveThermal"
                    stackId="1"
                    stroke="#475569"
                    fill="#334155"
                    fillOpacity={0.8}
                    name="Base Thermal MW"
                  />
                  <Area
                    type="monotone"
                    dataKey="buffer"
                    stackId="1"
                    stroke="#F43F5E"
                    fill="#F43F5E"
                    fillOpacity={0.7}
                    name="Reserve Buffer Delta_P"
                  />
                  <Line
                    type="monotone"
                    dataKey="demand"
                    stroke="#818CF8"
                    strokeWidth={2}
                    dot={false}
                    name="Total Demand D(t)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 48-Period Settlement Schedule Table */}
          <div className="rounded-2xl bg-obsidian-900 border border-obsidian-700/80 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-obsidian-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
                  48 Settlement Period Procurement Schedule
                </h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  Settlement breakdown with point-in-time causality, risk buffers, and ex-post outturns
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 text-xs font-mono transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs font-mono">
                <thead className="sticky top-0 bg-obsidian-950 text-slate-400 uppercase text-[10px] border-b border-obsidian-800 z-10">
                  <tr>
                    <th className="px-3 py-2.5">SP</th>
                    <th className="px-3 py-2.5">Start Time</th>
                    <th className="px-3 py-2.5 text-right">Forecast (MW)</th>
                    <th className="px-3 py-2.5 text-right">Firm Wind (MW)</th>
                    <th className="px-3 py-2.5 text-right">Demand (MW)</th>
                    <th className="px-3 py-2.5 text-right">Base Thermal</th>
                    <th className="px-3 py-2.5 text-right">Buffer Delta_P</th>
                    <th className="px-3 py-2.5 text-right">Rec Thermal</th>
                    <th className="px-3 py-2.5 text-right">Actual Outturn</th>
                    <th className="px-3 py-2.5 text-right">Signed Miss</th>
                    <th className="px-3 py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-800/60 bg-obsidian-900/40">
                  {data.periods.map((p) => {
                    const isShortfall = (p.signed_error_mw ?? 0) > 1000;
                    return (
                      <tr
                        key={p.settlement_period}
                        className={`hover:bg-obsidian-800/60 transition-colors ${
                          isShortfall ? 'bg-rose-500/5' : ''
                        }`}
                      >
                        <td className="px-3 py-2 font-bold text-slate-300">SP {p.settlement_period}</td>
                        <td className="px-3 py-2 text-slate-400">{p.start_time_utc.slice(11, 16)} UTC</td>
                        <td className="px-3 py-2 text-right font-semibold text-cyan-400">
                          {p.forecast_mw.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-400 font-semibold">
                          {p.firm_wind_mw.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-indigo-300">
                          {p.demand_mw.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-400">
                          {p.naive_thermal_mw.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-rose-400 font-semibold">
                          +{p.shortfall_buffer_mw.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-white">
                          {p.recommended_thermal_mw.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-amber-400">
                          {p.actual_mw !== null ? p.actual_mw.toLocaleString() : '-'}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-semibold ${
                            (p.signed_error_mw ?? 0) > 0 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {p.signed_error_mw !== null ? `${p.signed_error_mw > 0 ? '+' : ''}${p.signed_error_mw.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {onOpenEvolution && (
                            <button
                              type="button"
                              onClick={() => onOpenEvolution(p.start_time_utc)}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all border border-cyan-500/30"
                            >
                              Cone
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
