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
    <div className="space-y-4">
      {/* Scope Header Card */}
      <div className="rounded-md bg-[#0C1017] border border-slate-800 p-3 px-4 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
        <div>
          <h2 className="text-xs font-bold font-mono text-white uppercase tracking-wider flex items-center space-x-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>January 2026 Renewable Forecast Verification Audit</span>
          </h2>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            Ex-Post Point-in-Time Residual Analysis across {data?.sample_count ?? 1488} Settlement Periods
          </p>
        </div>
        {data && (
          <div className="flex items-center space-x-1.5 text-xs font-mono">
            <span className="px-2 py-0.5 rounded-sm bg-[#070A10] border border-slate-800 text-slate-300">
              Samples: <strong className="text-cyan-400 tabular-nums">{data.sample_count}</strong>
            </span>
            <span className="px-2 py-0.5 rounded-sm bg-[#070A10] border border-slate-800 text-slate-300">
              Avg Lead: <strong className="text-emerald-400 tabular-nums">{data.global_metrics.mean_lead_time_hours}h</strong>
            </span>
            <span className="px-2 py-0.5 rounded-sm bg-[#070A10] border border-slate-800 text-slate-300">
              Gate: <strong className="text-white tabular-nums">{data.gate_closure} UTC</strong>
            </span>
          </div>
        )}
      </div>

      {loading && (
        <div className="p-8 text-center font-mono text-xs text-cyan-400 animate-pulse">
          Computing January 2026 Empirical Residuals & Quantiles...
        </div>
      )}

      {error && (
        <div className="p-3 rounded-md bg-rose-950/40 border border-rose-800/80 text-rose-300 flex items-center space-x-2 text-xs font-mono">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {data && !loading && (
        <>
          {/* 6 Macro KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Chart A: Error vs Lead-Time Horizon */}
            <div className="rounded-md bg-[#0C1017] border border-slate-800 p-3.5 shadow-sm">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                <div>
                  <h3 className="text-xs font-mono font-bold uppercase text-white tracking-wider flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Error vs Lead-Time Horizon (Decay Curve)</span>
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    How prediction uncertainty scales from 6h to 48h lead times
                  </p>
                </div>
              </div>
              <div className="h-60 w-full mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.error_by_horizon} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke="#1A2234" vertical={false} />
                    <XAxis
                      dataKey="horizon_bucket"
                      stroke="#475569"
                      tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'monospace' }}
                    />
                    <YAxis
                      stroke="#475569"
                      tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'monospace' }}
                      unit=" MW"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0B0E14',
                        borderColor: '#334155',
                        borderRadius: '0.25rem',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        padding: '6px 10px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                    <Bar dataKey="mae_mw" name="MAE (MW)" fill="#06B6D4" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="rmse_mw" name="RMSE (MW)" fill="#6366F1" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart B: Signed Error Distribution Histogram */}
            <div className="rounded-md bg-[#0C1017] border border-slate-800 p-3.5 shadow-sm">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                <div>
                  <h3 className="text-xs font-mono font-bold uppercase text-white tracking-wider flex items-center space-x-1.5">
                    <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Signed Error Distribution (Empirical Histogram)</span>
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Residual frequency with zero-line and shortfall tail risk
                  </p>
                </div>
              </div>
              <div className="h-60 w-full mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.error_histogram} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke="#1A2234" vertical={false} />
                    <XAxis
                      dataKey="bin_start_mw"
                      stroke="#475569"
                      tick={{ fill: '#94A3B8', fontSize: 9, fontFamily: 'monospace' }}
                      interval={3}
                      tickFormatter={(v) => `${v}M`}
                    />
                    <YAxis
                      stroke="#475569"
                      tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'monospace' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0B0E14',
                        borderColor: '#334155',
                        borderRadius: '0.25rem',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        padding: '6px 10px',
                      }}
                    />
                    <Bar
                      dataKey="frequency"
                      name="Settlement Periods"
                      fill="#10B981"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart C: Diurnal Error Profile (SP 1 to 48) */}
            <div className="rounded-md bg-[#0C1017] border border-slate-800 p-3.5 shadow-sm">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                <div>
                  <h3 className="text-xs font-mono font-bold uppercase text-white tracking-wider flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Diurnal Volatility Profile (SP 1 to 48)</span>
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Settlement-period error and P90 shortfall throughout the 24-hour cycle
                  </p>
                </div>
              </div>
              <div className="h-60 w-full mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.diurnal_by_settlement_period} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke="#1A2234" vertical={false} />
                    <XAxis
                      dataKey="time_label"
                      stroke="#475569"
                      tick={{ fill: '#94A3B8', fontSize: 9, fontFamily: 'monospace' }}
                      interval={5}
                    />
                    <YAxis
                      stroke="#475569"
                      tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'monospace' }}
                      unit=" MW"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0B0E14',
                        borderColor: '#334155',
                        borderRadius: '0.25rem',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        padding: '6px 10px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                    <Line
                      type="monotone"
                      dataKey="mae_mw"
                      name="MAE (MW)"
                      stroke="#06B6D4"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="p90_shortfall_mw"
                      name="P90 Shortfall (MW)"
                      stroke="#F43F5E"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart D: Daily Accuracy Timeline */}
            <div className="rounded-md bg-[#0C1017] border border-slate-800 p-3.5 shadow-sm">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                <div>
                  <h3 className="text-xs font-mono font-bold uppercase text-white tracking-wider flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Daily Accuracy Timeline (January 2026)</span>
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Daily MAE and peak shortfall across the month
                  </p>
                </div>
              </div>
              <div className="h-60 w-full mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.daily_timeline} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke="#1A2234" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#475569"
                      tick={{ fill: '#94A3B8', fontSize: 9, fontFamily: 'monospace' }}
                      interval={4}
                      tickFormatter={(d) => d.slice(5)}
                    />
                    <YAxis
                      stroke="#475569"
                      tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'monospace' }}
                      unit=" MW"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0B0E14',
                        borderColor: '#334155',
                        borderRadius: '0.25rem',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        padding: '6px 10px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                    <Bar dataKey="mae_mw" name="Daily MAE" fill="#6366F1" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="peak_shortfall_mw" name="Peak Shortfall" fill="#F43F5E" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top 5 Extreme Shortfall Events Table */}
          <div className="rounded-md bg-[#0C1017] border border-slate-800 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Top 5 Extreme Wind Shortfall Events (January 2026)</span>
                </h3>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Largest over-forecast deficits in January 2026. Click any row to inspect the Forecast Evolution Cone.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#0B0E14] text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-1.5">Rank</th>
                    <th className="px-3 py-1.5">Date</th>
                    <th className="px-3 py-1.5">Period (SP)</th>
                    <th className="px-3 py-1.5">Delivery Time UTC</th>
                    <th className="px-3 py-1.5">Lead Time</th>
                    <th className="px-3 py-1.5 text-right">Forecast (MW)</th>
                    <th className="px-3 py-1.5 text-right">Actual Outturn</th>
                    <th className="px-3 py-1.5 text-right">Shortfall Deficit</th>
                    <th className="px-3 py-1.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-[#0C1017]">
                  {data.top_worst_shortfalls.map((item) => (
                    <tr
                      key={item.rank}
                      onClick={() => onOpenEvolution(item.start_time_utc)}
                      className="hover:bg-rose-950/25 transition-colors cursor-pointer group tabular-nums"
                    >
                      <td className="px-3 py-2 font-bold text-white">
                        <span className="w-4 h-4 rounded-xs bg-rose-950/60 text-rose-400 flex items-center justify-center border border-rose-800/70 text-[10px]">
                          {item.rank}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-200">{item.date}</td>
                      <td className="px-3 py-2 font-semibold text-cyan-400">SP {item.settlement_period}</td>
                      <td className="px-3 py-2 text-slate-400">{item.start_time_utc.slice(11, 16)} UTC</td>
                      <td className="px-3 py-2 text-slate-300">{item.lead_time_hours}h</td>
                      <td className="px-3 py-2 text-right font-semibold text-cyan-300">
                        {item.forecast_mw.toLocaleString()} MW
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-amber-400">
                        {item.actual_mw.toLocaleString()} MW
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-rose-400 text-xs">
                        +{item.shortfall_mw.toLocaleString()} MW
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex items-center space-x-1 text-[10px] font-mono text-cyan-400 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all">
                          <span>Inspect Cone</span>
                          <ArrowRight className="w-3 h-3" />
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
