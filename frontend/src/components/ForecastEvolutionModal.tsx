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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-obsidian-900 border border-obsidian-700 shadow-2xl p-6">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-obsidian-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white font-mono">
                  Forecast Evolution Cone (Horizon Trajectory)
                </h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Target: {targetStartTime.replace('T', ' ').replace(':00Z', ' UTC')}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Progression of all NGESO WINDFOR runs published leading up to real-time delivery
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Clock className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-sm font-mono text-slate-400">Loading forecast evolution runs...</p>
          </div>
        )}

        {error && (
          <div className="my-8 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {data && !loading && (
          <div className="mt-6 space-y-6">
            {/* Top Stat Summary Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                <span className="text-[10px] font-mono uppercase text-slate-400">Settlement Date</span>
                <p className="text-base font-mono font-bold text-white mt-1">{data.settlement_date}</p>
              </div>
              <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                <span className="text-[10px] font-mono uppercase text-slate-400">Settlement Period</span>
                <p className="text-base font-mono font-bold text-cyan-400 mt-1">SP {data.settlement_period}</p>
              </div>
              <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                <span className="text-[10px] font-mono uppercase text-slate-400">Actual Outturn</span>
                <p className="text-base font-mono font-bold text-amber-400 mt-1">
                  {data.actual_mw ? `${data.actual_mw.toLocaleString()} MW` : 'N/A'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                <span className="text-[10px] font-mono uppercase text-slate-400">Evolution Runs</span>
                <p className="text-base font-mono font-bold text-emerald-400 mt-1">{data.runs.length} runs</p>
              </div>
            </div>

            {/* Horizon Trajectory Chart */}
            <div className="p-4 rounded-xl bg-obsidian-950 border border-obsidian-800">
              <h4 className="text-xs font-mono font-semibold uppercase text-slate-300 mb-3">
                Forecast Generation vs Lead Time to Delivery
              </h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.runs.map((r) => ({
                      publish: r.publish_time_utc.slice(5, 16).replace('T', ' '),
                      leadHours: `${r.lead_time_hours}h`,
                      forecast: r.forecast_mw,
                      actual: data.actual_mw,
                      shortfall: r.shortfall_mw,
                    }))}
                    margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                    <XAxis
                      dataKey="leadHours"
                      stroke="#6B7280"
                      tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'monospace' }}
                      label={{ value: 'Lead Time Hours Ahead (48h -> 0h)', position: 'insideBottom', offset: -10, fill: '#6B7280', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#6B7280"
                      tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'monospace' }}
                      domain={['auto', 'auto']}
                      label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#6B7280', fontSize: 11 }}
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
                    <Legend
                      verticalAlign="top"
                      height={36}
                      wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      name="Forecast MW"
                      stroke="#06B6D4"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#06B6D4' }}
                      activeDot={{ r: 6 }}
                    />
                    {data.actual_mw !== null && (
                      <ReferenceLine
                        y={data.actual_mw}
                        stroke="#F59E0B"
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        label={{
                          value: `Actual Outturn: ${data.actual_mw.toLocaleString()} MW`,
                          fill: '#F59E0B',
                          fontSize: 11,
                          fontFamily: 'monospace',
                        }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Run-by-Run Detailed Table */}
            <div className="overflow-x-auto rounded-xl border border-obsidian-800">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-obsidian-950 text-slate-400 uppercase text-[10px] border-b border-obsidian-800">
                  <tr>
                    <th className="px-3 py-2">Publish Time (UTC)</th>
                    <th className="px-3 py-2">Lead Time</th>
                    <th className="px-3 py-2 text-right">Forecast (MW)</th>
                    <th className="px-3 py-2 text-right">Signed Error</th>
                    <th className="px-3 py-2 text-right">Shortfall (MW)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-800 bg-obsidian-900/50">
                  {data.runs.map((r, i) => (
                    <tr key={i} className="hover:bg-obsidian-800/60">
                      <td className="px-3 py-2 text-slate-300">
                        {r.publish_time_utc.replace('T', ' ').replace(':00Z', '')}
                      </td>
                      <td className="px-3 py-2 text-cyan-400 font-semibold">{r.lead_time_hours}h</td>
                      <td className="px-3 py-2 text-right font-bold text-white">
                        {r.forecast_mw.toLocaleString()}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold ${
                          (r.signed_error_mw ?? 0) > 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {r.signed_error_mw !== null ? `${r.signed_error_mw > 0 ? '+' : ''}${r.signed_error_mw.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-rose-400">
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
