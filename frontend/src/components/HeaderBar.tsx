import React, { useState } from 'react';
import {
  Activity,
  Calendar,
  Clock,
  Layers,
  Radio,
  Zap,
} from 'lucide-react';
import { EvaluationScope, GateClosure, InterpolationMode, LiveVerifyResponse } from '../types/api';
import { verifyElexonLive } from '../services/apiClient';

interface HeaderBarProps {
  activeTab: 'trading' | 'audit';
  setActiveTab: (tab: 'trading' | 'audit') => void;
  gateClosure: GateClosure;
  setGateClosure: (gc: GateClosure) => void;
  scope: EvaluationScope;
  setScope: (scope: EvaluationScope) => void;
  interpolation: InterpolationMode;
  setInterpolation: (mode: InterpolationMode) => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  activeTab,
  setActiveTab,
  gateClosure,
  setGateClosure,
  scope,
  setScope,
  interpolation,
  setInterpolation,
}) => {
  const [liveStatus, setLiveStatus] = useState<LiveVerifyResponse | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleLivePing = async () => {
    setIsVerifying(true);
    try {
      const res = await verifyElexonLive();
      setLiveStatus(res);
    } catch {
      setLiveStatus(null);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-obsidian-950/95 backdrop-blur border-b border-obsidian-700/80 px-4 lg:px-6 py-3">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Brand & Tabs */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-emerald-400 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-obsidian-950 rounded-[7px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-sm tracking-wider uppercase text-white font-mono">
                  GRIDBRICKS
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  UK DAY-AHEAD TERMINAL
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Elexon BMRS January 2026 Audit & Risk Dispatch
              </p>
            </div>
          </div>

          {/* Tab buttons for mobile */}
          <div className="flex lg:hidden bg-obsidian-900 border border-obsidian-700 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('trading')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                activeTab === 'trading'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Trading Desk
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                activeTab === 'audit'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Accuracy Audit
            </button>
          </div>
        </div>

        {/* Desktop View Switcher */}
        <div className="hidden lg:flex items-center bg-obsidian-900/90 border border-obsidian-700/80 p-1 rounded-xl shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('trading')}
            className={`flex items-center space-x-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'trading'
                ? 'bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 text-cyan-300 border border-cyan-500/40 shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Trading Desk (Day-Ahead)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`flex items-center space-x-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'audit'
                ? 'bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 text-cyan-300 border border-cyan-500/40 shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Accuracy Audit (Jan 2026)</span>
          </button>
        </div>

        {/* Global Controls & Live Connectivity */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Gate Closure Selector */}
          <div className="flex items-center bg-obsidian-900 border border-obsidian-700/80 rounded-lg px-2.5 py-1 text-xs space-x-2">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400 font-mono text-[11px]">Gate:</span>
            <select
              value={gateClosure}
              onChange={(e) => setGateClosure(e.target.value as GateClosure)}
              className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer"
            >
              <option value="09:20" className="bg-obsidian-900">09:20 UTC (EPEX)</option>
              <option value="09:50" className="bg-obsidian-900">09:50 UTC (N2EX)</option>
              <option value="15:30" className="bg-obsidian-900">15:30 UTC (GB HH)</option>
            </select>
          </div>

          {/* Scope Selector */}
          <div className="flex items-center bg-obsidian-900 border border-obsidian-700/80 rounded-lg px-2.5 py-1 text-xs space-x-2">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as EvaluationScope)}
              className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer"
            >
              <option value="delivery_jan" className="bg-obsidian-900">Deliveries in Jan 2026</option>
              <option value="decision_jan" className="bg-obsidian-900">Decisions in Jan 2026</option>
            </select>
          </div>

          {/* Interpolation Toggle */}
          <div className="flex items-center bg-obsidian-900 border border-obsidian-700/80 rounded-lg px-2.5 py-1 text-xs space-x-2">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={interpolation}
              onChange={(e) => setInterpolation(e.target.value as InterpolationMode)}
              className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer"
            >
              <option value="linear" className="bg-obsidian-900">Linear (48 SP)</option>
              <option value="exact" className="bg-obsidian-900">Exact Hourly (24 SP)</option>
            </select>
          </div>

          {/* Live Elexon Stream Verification Badge */}
          <button
            type="button"
            onClick={handleLivePing}
            disabled={isVerifying}
            title="Click to test live upstream Elexon BMRS API connectivity"
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-obsidian-900 border border-emerald-500/30 hover:border-emerald-500/60 text-[11px] font-mono text-emerald-400 transition-all shadow"
          >
            <Radio className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin text-amber-400' : 'text-emerald-400'}`} />
            <span>
              {isVerifying
                ? 'Pinging Elexon...'
                : liveStatus
                ? `Live: ${liveStatus.latency_ms}ms`
                : 'Elexon Stream: Online'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
