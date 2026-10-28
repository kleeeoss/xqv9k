import React, { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Clock, History, X } from 'lucide-react';
import { ForecastEvolutionResponse } from '../types/api';
import { fetchForecastEvolution } from '../services/apiClient';

interface ForecastEvolutionModalProps {
  targetStartTime: string | null;
  onClose: () => void;
}

export const ForecastEvolutionModal: React.FC<ForecastEvolutionModalProps> = ({
  targetStartTime,
  onClose,
}) => {
  const [data, setData] = useState<ForecastEvolutionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetStartTime) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchForecastEvolution(targetStartTime)
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
  }, [targetStartTime]);

  if (!targetStartTime) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-md bg-[#0B0E14] border border-slate-700 shadow-2xl p-4 sm:p-5">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-sm bg-[#121824] text-cyan-400 border border-slate-700">
              <History className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                  Forecast Evolution Cone (Horizon Trajectory)
                </h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-[#161D2B] text-cyan-300 border border-slate-700">
                  Target: {targetStartTime.replace('T', ' ').replace(':00Z', ' UTC')}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                Progression of all NGESO WINDFOR runs published leading up to real-time delivery
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        {loading && (
          <div className="py-16 flex flex-col items-center justify-center space-y-2">
            <Clock className="w-6 h-6 text-cyan-400 animate-spin" />
            <p className="text-xs font-mono text-slate-400">Loading forecast evolution runs...</p>
          </div>
        )}

        {error && (
          <div className="my-6 p-3 rounded-md bg-rose-950/40 border border-rose-800/80 text-rose-300 flex items-center space-x-2 text-xs font-mono">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {data && !loading && (
          <div className="mt-4 space-y-4">
            {/* Top Stat Summary Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-sm bg-[#0C1017] border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-400">Settlement Date</span>
                <p className="text-sm font-mono font-bold text-white mt-0.5">{data.settlement_date}</p>
              </div>
              <div className="p-2.5 rounded-sm bg-[#0C1017] border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-400">Settlement Period</span>
                <p className="text-sm font-mono font-bold text-cyan-400 mt-0.5">SP {data.settlement_period}</p>
              </div>
              <div className="p-2.5 rounded-sm bg-[#0C1017] border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-400">Actual Outturn</span>
                <p className="text-sm font-mono font-bold text-amber-400 mt-0.5 tabular-nums">
                  {data.actual_mw ? `${data.actual_mw.toLocaleString()} MW` : 'N/A'}
                </p>
              </div>
              <div className="p-2.5 rounded-sm bg-[#0C1017] border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-400">Evolution Runs</span>
                <p className="text-sm font-mono font-bold text-emerald-400 mt-0.5">{data.runs.length} runs</p>
              </div>
            </div>

            {/* Horizon Trajectory Chart */}
            <div className="p-3 rounded-sm bg-[#0C1017] border border-slate-800">
              <h4 className="text-[10px] font-mono font-semibold uppercase text-slate-400 mb-2">
                Forecast Generation vs Lead Time to Delivery
              </h4>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.runs.map((r) => ({
                      publish: r.publish_time_utc.slice(5, 16).replace('T', ' '),
                      leadHours: `${r.lead_time_hours}h`,
                      forecast: r.forecast_mw,
                      actual: data.actual_mw,
                      shortfall: r.shortfall_mw,
                    }))}
                    margin={{ top: 8, right: 15, left: -10, bottom: 15 }}
                  >
                    <CartesianGrid strokeDasharray="2 2" stroke="#1A2234" vertical={false} />
                    <XAxis
                      dataKey="leadHours"
                      stroke="#475569"
                      tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'monospace' }}
                      label={{ value: 'Lead Time Hours Ahead (48h -> 0h)', position: 'insideBottom', offset: -10, fill: '#64748B', fontSize: 10 }}
                    />
                    <YAxis
                      stroke="#475569"
                      tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'monospace' }}
                      domain={['auto', 'auto']}
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
                    <Legend
                      verticalAlign="top"
                      height={30}
                      wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      name="Forecast MW"
                      stroke="#06B6D4"
                      strokeWidth={1.5}
                      dot={{ r: 3, fill: '#06B6D4' }}
                      activeDot={{ r: 5 }}
                    />
                    {data.actual_mw !== null && (
                      <ReferenceLine
                        y={data.actual_mw}
                        stroke="#F59E0B"
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                        label={{
                          value: `Actual Outturn: ${data.actual_mw.toLocaleString()} MW`,
                          fill: '#F59E0B',
                          fontSize: 10,
                          fontFamily: 'monospace',
                        }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Run-by-Run Detailed Table */}
            <div className="overflow-x-auto rounded-sm border border-slate-800">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#0B0E14] text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-2.5 py-1.5">Publish Time (UTC)</th>
                    <th className="px-2.5 py-1.5">Lead Time</th>
                    <th className="px-2.5 py-1.5 text-right">Forecast (MW)</th>
                    <th className="px-2.5 py-1.5 text-right">Signed Error</th>
                    <th className="px-2.5 py-1.5 text-right">Shortfall (MW)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-[#0C1017]">
                  {data.runs.map((r, i) => (
                    <tr key={i} className="hover:bg-[#161D2B] tabular-nums">
                      <td className="px-2.5 py-1.5 text-slate-300">
                        {r.publish_time_utc.replace('T', ' ').replace(':00Z', '')}
                      </td>
                      <td className="px-2.5 py-1.5 text-cyan-400 font-semibold">{r.lead_time_hours}h</td>
                      <td className="px-2.5 py-1.5 text-right font-bold text-white">
                        {r.forecast_mw.toLocaleString()}
                      </td>
                      <td
                        className={`px-2.5 py-1.5 text-right font-semibold ${
                          (r.signed_error_mw ?? 0) > 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {r.signed_error_mw !== null ? `${r.signed_error_mw > 0 ? '+' : ''}${r.signed_error_mw.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-bold text-rose-400">
                        {r.shortfall_mw !== null && r.shortfall_mw > 0
                          ? `${r.shortfall_mw.toLocaleString()} MW`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
