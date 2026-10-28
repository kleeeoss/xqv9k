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
    <header className="sticky top-0 z-40 bg-[#0B0E14] border-b border-slate-800/90 px-3 lg:px-5 py-2 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
        {/* Brand & Tab Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 rounded-sm bg-[#121824] border border-slate-700/80 flex items-center justify-center">
              <Zap className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-mono font-bold text-xs tracking-wider uppercase text-white">
                GRIDBRICKS
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-[#161D2B] text-slate-300 border border-slate-700">
                UK POWER DESK
              </span>
              <span className="hidden sm:inline-block text-[11px] text-slate-500 font-mono">
                // BMRS JAN 2026
              </span>
            </div>
          </div>

          {/* Mobile View Switcher */}
          <div className="flex lg:hidden bg-[#070A10] border border-slate-800 p-0.5 rounded-sm">
            <button
              type="button"
              onClick={() => setActiveTab('trading')}
              className={`px-2 py-0.5 text-xs font-mono rounded-sm transition-all ${
                activeTab === 'trading'
                  ? 'bg-[#121824] text-cyan-300 border border-cyan-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Trading Desk
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`px-2 py-0.5 text-xs font-mono rounded-sm transition-all ${
                activeTab === 'audit'
                  ? 'bg-[#121824] text-cyan-300 border border-cyan-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Accuracy Audit
            </button>
          </div>
        </div>

        {/* Desktop View Switcher */}
        <div className="hidden lg:flex items-center bg-[#070A10] border border-slate-800 rounded-sm p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('trading')}
            className={`flex items-center space-x-2 px-3.5 py-1 text-xs font-mono font-semibold uppercase tracking-wider rounded-sm transition-all ${
              activeTab === 'trading'
                ? 'bg-[#121824] text-cyan-300 border border-cyan-500/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#0C1017]'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Trading Desk (Day-Ahead)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`flex items-center space-x-2 px-3.5 py-1 text-xs font-mono font-semibold uppercase tracking-wider rounded-sm transition-all ${
              activeTab === 'audit'
                ? 'bg-[#121824] text-cyan-300 border border-cyan-500/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#0C1017]'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Accuracy Audit (Jan 2026)</span>
          </button>
        </div>

        {/* Operational Command Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Gate Closure Selector */}
          <div className="flex items-center bg-[#070A10] border border-slate-800 rounded-sm px-2 py-0.5 text-xs space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-500 font-mono text-[10px] uppercase">Gate:</span>
            <select
              value={gateClosure}
              onChange={(e) => setGateClosure(e.target.value as GateClosure)}
              className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer"
            >
              <option value="09:20" className="bg-[#0B0E14]">09:20 UTC (EPEX)</option>
              <option value="09:50" className="bg-[#0B0E14]">09:50 UTC (N2EX)</option>
              <option value="15:30" className="bg-[#0B0E14]">15:30 UTC (GB HH)</option>
            </select>
          </div>

          {/* Scope Selector */}
          <div className="flex items-center bg-[#070A10] border border-slate-800 rounded-sm px-2 py-0.5 text-xs space-x-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as EvaluationScope)}
              className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer"
            >
              <option value="delivery_jan" className="bg-[#0B0E14]">Deliveries in Jan 2026</option>
              <option value="decision_jan" className="bg-[#0B0E14]">Decisions in Jan 2026</option>
            </select>
          </div>

          {/* Interpolation Toggle */}
          <div className="flex items-center bg-[#070A10] border border-slate-800 rounded-sm px-2 py-0.5 text-xs space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={interpolation}
              onChange={(e) => setInterpolation(e.target.value as InterpolationMode)}
              className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer"
            >
              <option value="linear" className="bg-[#0B0E14]">Linear (48 SP)</option>
              <option value="exact" className="bg-[#0B0E14]">Exact Hourly (24 SP)</option>
            </select>
          </div>

          {/* Live Elexon Stream Verification Badge */}
          <button
            type="button"
            onClick={handleLivePing}
            disabled={isVerifying}
            title="Click to test live upstream Elexon BMRS API connectivity"
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-sm bg-[#070A10] border border-emerald-900/60 hover:border-emerald-500/80 text-[11px] font-mono text-emerald-400 transition-all shadow-sm"
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
