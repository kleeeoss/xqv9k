import React, { useState } from 'react';
import { HelpCircle, LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  formulaTooltip?: string;
  icon?: LucideIcon;
  variant?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'slate';
  badge?: string;
}

const variantStyles = {
  cyan: {
    border: 'border-cyan-500/30 hover:border-cyan-500/60',
    glow: 'from-cyan-500/10 to-transparent',
    text: 'text-cyan-400',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    iconBg: 'bg-cyan-500/10 text-cyan-400',
  },
  emerald: {
    border: 'border-emerald-500/30 hover:border-emerald-500/60',
    glow: 'from-emerald-500/10 to-transparent',
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    iconBg: 'bg-emerald-500/10 text-emerald-400',
  },
  amber: {
    border: 'border-amber-500/30 hover:border-amber-500/60',
    glow: 'from-amber-500/10 to-transparent',
    text: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    iconBg: 'bg-amber-500/10 text-amber-400',
  },
  rose: {
    border: 'border-rose-500/30 hover:border-rose-500/60',
    glow: 'from-rose-500/10 to-transparent',
    text: 'text-rose-400',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    iconBg: 'bg-rose-500/10 text-rose-400',
  },
  indigo: {
    border: 'border-indigo-500/30 hover:border-indigo-500/60',
    glow: 'from-indigo-500/10 to-transparent',
    text: 'text-indigo-400',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    iconBg: 'bg-indigo-500/10 text-indigo-400',
  },
  slate: {
    border: 'border-slate-700/60 hover:border-slate-600',
    glow: 'from-slate-700/10 to-transparent',
    text: 'text-slate-200',
    badge: 'bg-slate-800 text-slate-300 border-slate-700',
    iconBg: 'bg-slate-800 text-slate-400',
  },
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  formulaTooltip,
  icon: Icon,
  variant = 'slate',
  badge,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const styles = variantStyles[variant];

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-obsidian-900 border ${styles.border} p-4 transition-all duration-200 shadow-lg`}
    >
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${styles.glow} pointer-events-none rounded-bl-full`} />

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {Icon && (
            <div className={`p-1.5 rounded-lg ${styles.iconBg}`}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</span>
        </div>

        <div className="flex items-center space-x-1.5">
          {badge && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${styles.badge}`}>
              {badge}
            </span>
          )}
          {formulaTooltip && (
            <div className="relative">
              <button
                type="button"
                className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={() => setShowTooltip(!showTooltip)}
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
              {showTooltip && (
                <div className="absolute right-0 top-6 z-50 w-64 p-2.5 rounded-lg bg-obsidian-800 border border-slate-700 shadow-xl text-[11px] text-slate-300 font-mono leading-relaxed pointer-events-none">
                  {formulaTooltip}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-baseline space-x-2">
        <span className={`text-2xl font-bold font-mono tracking-tight ${styles.text}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && <span className="text-xs font-mono text-slate-400">{unit}</span>}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-slate-400 font-sans truncate">{subtitle}</p>
      )}
    </div>
  );
};
