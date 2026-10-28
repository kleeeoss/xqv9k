import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Calendar,
  Clock,
  Compass,
  FileText,
} from 'lucide-react';
import {
  AccuracyAuditResponse,
  EvaluationScope,
  GateClosure,
  InterpolationMode,
} from '../types/api';
import { fetchAccuracyAudit } from '../services/apiClient';
import { MetricCard } from './MetricCard';

interface AccuracyAuditTabProps {
  gateClosure: GateClosure;
  scope: EvaluationScope;
  interpolation: InterpolationMode;
  onOpenEvolution: (startTimeUtc: string) => void;
}

export const AccuracyAuditTab: React.FC<AccuracyAuditTabProps> = ({
  gateClosure,
  scope,
  interpolation,
  onOpenEvolution,
}) => {
  const [data, setData] = useState<AccuracyAuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchAccuracyAudit({
      gate_closure: gateClosure,
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
  }, [gateClosure, scope, interpolation]);

  return (
    <div className="space-y-6">
      {/* Scope Header Card */}
      <div className="rounded-2xl bg-obsidian-900 border border-obsidian-700/80 p-4 lg:p-5 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold font-mono text-white flex items-center space-x-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <span>January 2026 Renewable Forecast Verification Audit</span>
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Ex-Post Point-in-Time Residual Analysis across {data?.sample_count ?? 1488} Settlement Periods
          </p>
        </div>
        {data && (
          <div className="flex items-center space-x-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-obsidian-950 border border-obsidian-700 text-slate-300">
              Samples: <strong className="text-cyan-400">{data.sample_count}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-obsidian-950 border border-obsidian-700 text-slate-300">
              Avg Lead: <strong className="text-emerald-400">{data.global_metrics.mean_lead_time_hours}h</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-obsidian-950 border border-obsidian-700 text-slate-300">
              Gate: <strong className="text-white">{data.gate_closure} UTC</strong>
            </span>
          </div>
        )}
      </div>

      {loading && (
        <div className="p-12 text-center font-mono text-cyan-400 animate-pulse">
          Computing January 2026 Empirical Residuals & Quantiles...
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
          {/* 6 Macro KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard
              title="MAE"
              value={data.global_metrics.mae_mw}
              unit="MW"
              subtitle="Mean Absolute Error"
              formulaTooltip="MAE = (1/N) * sum(|W_hat - W|). Average absolute magnitude of forecast error across the month."
              variant="cyan"
              icon={Activity}
            />
            <MetricCard
              title="RMSE"
              value={data.global_metrics.rmse_mw}
              unit="MW"
              subtitle="Root Mean Squared Error"
              formulaTooltip="RMSE = sqrt((1/N) * sum((W_hat - W)^2)). Penalizes severe grid-destabilizing tail blunders."
              variant="indigo"
              icon={BarChart2}
            />
            <MetricCard
              title="MBE (Bias)"
              value={`${data.global_metrics.mbe_mw > 0 ? '+' : ''}${data.global_metrics.mbe_mw}`}
              unit="MW"
              subtitle={data.global_metrics.mbe_mw > 0 ? 'Over-predicting' : 'Under-predicting'}
              formulaTooltip="MBE = (1/N) * sum(W_hat - W). Positive indicates systematic over-estimation of wind generation."
              variant={data.global_metrics.mbe_mw > 0 ? 'amber' : 'slate'}
              icon={Compass}
            />
            <MetricCard
              title="MAPE"
              value={`${data.global_metrics.mape_pct}%`}
              subtitle={`NMAE: ${data.global_metrics.nmae_pct}%`}
              formulaTooltip="MAPE = (100/N) * sum(|e| / max(W, 100MW)). Relative error percentage with 100MW zero-wind floor."
              variant="slate"
              icon={FileText}
            />
            <MetricCard
              title="VaR-90 Shortfall"
              value={data.global_metrics.p90_shortfall_mw}
              unit="MW"
              subtitle="P90 Risk Quantile"
              formulaTooltip="VaR_90 = Q_0.90(Shortfall). 90% of all settlement periods in Jan 2026 experienced shortfalls below this value."
              variant="rose"
              icon={AlertOctagon}
              badge="Standard"
            />
            <MetricCard
              title="VaR-95 Shortfall"
              value={data.global_metrics.p95_shortfall_mw}
              unit="MW"
              subtitle="P95 Stress Quantile"
              formulaTooltip="VaR_95 = Q_0.95(Shortfall). 95% shortfall risk ceiling. Tail buffer for extreme winter grid stress."
              variant="rose"
              icon={AlertOctagon}
              badge="Tail Risk"
            />
          </div>

          {/* 2x2 Analytical Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart A: Error vs Lead-Time Horizon */}
            <div className="rounded-2xl bg-obsidian-900 border border-obsidian-700/80 p-4 lg:p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-obsidian-800">
                <div>
                  <h3 className="text-xs font-mono font-bold uppercase text-white tracking-wider flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span>Error vs Lead-Time Horizon (Decay Curve)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                    How prediction uncertainty scales from 6h to 48h lead times
                  </p>
                </div>
              </div>
              <div className="h-64 w-full mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.error_by_horizon} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                    <XAxis
                      dataKey="horizon_bucket"
                      stroke="#6B7280"
                      tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'monospace' }}
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
                    <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
                    <Bar dataKey="mae_mw" name="MAE (MW)" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="rmse_mw" name="RMSE (MW)" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart B: Signed Error Distribution Histogram */}
            <div className="rounded-2xl bg-obsidian-900 border border-obsidian-700/80 p-4 lg:p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-obsidian-800">
                <div>
                  <h3 className="text-xs font-mono font-bold uppercase text-white tracking-wider flex items-center space-x-2">
                    <BarChart2 className="w-4 h-4 text-emerald-400" />
                    <span>Signed Error Distribution (Empirical Histogram)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                    Residual frequency with zero-line and shortfall tail risk
                  </p>
                </div>
              </div>
              <div className="h-64 w-full mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.error_histogram} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                    <XAxis
                      dataKey="bin_start_mw"
                      stroke="#6B7280"
                      tick={{ fill: '#9CA3AF', fontSize: 10, fontFamily: 'monospace' }}
                      interval={3}
                      tickFormatter={(v) => `${v}M`}
                    />
                    <YAxis
                      stroke="#6B7280"
                      tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'monospace' }}
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
                    <Bar
                      dataKey="frequency"
                      name="Settlement Periods"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart C: Diurnal Error Profile (SP 1 to 48) */}
            <div className="rounded-2xl bg-obsidian-900 border border-obsidian-700/80 p-4 lg:p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-obsidian-800">
                <div>
                  <h3 className="text-xs font-mono font-bold uppercase text-white tracking-wider flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Diurnal Volatility Profile (SP 1 to 48)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                    Settlement-period error and P90 shortfall throughout the 24-hour cycle
                  </p>
                </div>
              </div>
              <div className="h-64 w-full mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.diurnal_by_settlement_period} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                    <XAxis
                      dataKey="time_label"
                      stroke="#6B7280"
                      tick={{ fill: '#9CA3AF', fontSize: 10, fontFamily: 'monospace' }}
                      interval={5}
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
                    <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
                    <Line
                      type="monotone"
                      dataKey="mae_mw"
                      name="MAE (MW)"
                      stroke="#06B6D4"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="p90_shortfall_mw"
                      name="P90 Shortfall (MW)"
                      stroke="#F43F5E"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart D: Daily Accuracy Timeline */}
            <div className="rounded-2xl bg-obsidian-900 border border-obsidian-700/80 p-4 lg:p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-obsidian-800">
                <div>
                  <h3 className="text-xs font-mono font-bold uppercase text-white tracking-wider flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    <span>Daily Accuracy Timeline (January 2026)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                    Daily MAE and peak shortfall across the month
                  </p>
                </div>
              </div>
              <div className="h-64 w-full mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.daily_timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#6B7280"
                      tick={{ fill: '#9CA3AF', fontSize: 10, fontFamily: 'monospace' }}
                      interval={4}
                      tickFormatter={(d) => d.slice(5)}
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
                    <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
                    <Bar dataKey="mae_mw" name="Daily MAE" fill="#6366F1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="peak_shortfall_mw" name="Peak Shortfall" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top 5 Extreme Shortfall Events Table */}
          <div className="rounded-2xl bg-obsidian-900 border border-obsidian-700/80 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-obsidian-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Top 5 Extreme Wind Shortfall Events (January 2026)</span>
                </h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  Largest over-forecast deficits in January 2026. Click any row to inspect the Forecast Evolution Cone.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-obsidian-950 text-slate-400 uppercase text-[10px] border-b border-obsidian-800">
                  <tr>
                    <th className="px-4 py-2.5">Rank</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Period (SP)</th>
                    <th className="px-4 py-2.5">Delivery Time UTC</th>
                    <th className="px-4 py-2.5">Lead Time</th>
                    <th className="px-4 py-2.5 text-right">Forecast (MW)</th>
                    <th className="px-4 py-2.5 text-right">Actual Outturn</th>
                    <th className="px-4 py-2.5 text-right">Shortfall Deficit</th>
                    <th className="px-4 py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-800/60 bg-obsidian-900/40">
                  {data.top_worst_shortfalls.map((item) => (
                    <tr
                      key={item.rank}
                      onClick={() => onOpenEvolution(item.start_time_utc)}
                      className="hover:bg-rose-500/10 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3 font-bold text-white">
                        <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/40">
                          {item.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-200">{item.date}</td>
                      <td className="px-4 py-3 font-semibold text-cyan-400">SP {item.settlement_period}</td>
                      <td className="px-4 py-3 text-slate-400">{item.start_time_utc.slice(11, 16)} UTC</td>
                      <td className="px-4 py-3 text-slate-300">{item.lead_time_hours}h</td>
                      <td className="px-4 py-3 text-right font-semibold text-cyan-300">
                        {item.forecast_mw.toLocaleString()} MW
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-400">
                        {item.actual_mw.toLocaleString()} MW
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-rose-400 text-sm">
                        +{item.shortfall_mw.toLocaleString()} MW
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center space-x-1 text-[11px] font-mono text-cyan-400 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all">
                          <span>Inspect Cone</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
