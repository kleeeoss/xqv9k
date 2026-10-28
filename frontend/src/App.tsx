import React, { useState } from 'react';
import { EvaluationScope, GateClosure, InterpolationMode } from './types/api';
import { HeaderBar } from './components/HeaderBar';
import { TradingDeskTab } from './components/TradingDeskTab';
import { AccuracyAuditTab } from './components/AccuracyAuditTab';
import { ForecastEvolutionModal } from './components/ForecastEvolutionModal';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'trading' | 'audit'>('trading');
  const [gateClosure, setGateClosure] = useState<GateClosure>('09:20');
  const [scope, setScope] = useState<EvaluationScope>('delivery_jan');
  const [interpolation, setInterpolation] = useState<InterpolationMode>('linear');
  const [evolutionTarget, setEvolutionTarget] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Sticky Global Navigation & Control Header */}
      <HeaderBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        gateClosure={gateClosure}
        setGateClosure={setGateClosure}
        scope={scope}
        setScope={setScope}
        interpolation={interpolation}
        setInterpolation={setInterpolation}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6">
        {activeTab === 'trading' ? (
          <TradingDeskTab
            gateClosure={gateClosure}
            scope={scope}
            interpolation={interpolation}
            onOpenEvolution={(startTime) => setEvolutionTarget(startTime)}
          />
        ) : (
          <AccuracyAuditTab
            gateClosure={gateClosure}
            scope={scope}
            interpolation={interpolation}
            onOpenEvolution={(startTime) => setEvolutionTarget(startTime)}
          />
        )}
      </main>

      {/* Drilldown Horizon Cone Modal */}
      <ForecastEvolutionModal
        targetStartTime={evolutionTarget}
        onClose={() => setEvolutionTarget(null)}
      />

      {/* Terminal Footer */}
      <footer className="border-t border-obsidian-800 bg-obsidian-950 py-6 px-4 lg:px-6 mt-12 text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>UK Wholesale Power Desk Terminal | January 2026 Elexon Dataset</span>
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="https://github.com/kleeeoss/xqv9k"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
            >
              GitHub: kleeeoss/xqv9k
            </a>
            <span>•</span>
            <a
              href="/docs"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-300 transition-colors"
            >
              FastAPI Docs (/docs)
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
