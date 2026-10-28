import React, { useState, useRef, useEffect } from 'react';
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
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [placement, setPlacement] = useState<'left' | 'right'>('right');
  const tooltipRef = useRef<HTMLDivElement>(null);
  const styles = variantStyles[variant];

  const updatePlacement = () => {
    if (tooltipRef.current && typeof window !== 'undefined') {
      const rect = tooltipRef.current.getBoundingClientRect();
      setPlacement(rect.left < window.innerWidth / 2 ? 'left' : 'right');
    }
  };

  useEffect(() => {
    if (!isPinned) return;
    const handleOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setIsPinned(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isPinned]);

  const showTooltip = isHovered || isPinned;

  return (
    <div
      className={`relative overflow-visible rounded-xl bg-obsidian-900 border ${styles.border} p-4 transition-all duration-200 shadow-lg`}
      data-testid={`metric-card-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
    >
      {/* Decorative Glow constrained to rounded corners without clipping tooltips */}
      <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
        <div
          className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${styles.glow} rounded-bl-full`}
        />
      </div>

      <div className="flex items-center justify-between mb-2 relative z-10">
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
            <div className="relative" ref={tooltipRef}>
              <button
                type="button"
                data-testid="metric-card-info-button"
                aria-label={`Formula details for ${title}`}
                className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 focus:outline-none focus:text-cyan-400"
                onMouseEnter={() => {
                  updatePlacement();
                  setIsHovered(true);
                }}
                onMouseLeave={() => setIsHovered(false)}
                onClick={(e) => {
                  e.stopPropagation();
                  updatePlacement();
                  setIsPinned((prev) => !prev);
                }}
                onFocus={() => {
                  updatePlacement();
                  setIsHovered(true);
                }}
                onBlur={() => setIsHovered(false)}
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
              {showTooltip && (
                <div
                  role="tooltip"
                  className={`absolute ${placement === 'left' ? 'left-0' : 'right-0'} top-7 z-50 w-64 sm:w-72 max-w-[calc(100vw-2.5rem)] p-3 rounded-lg bg-obsidian-950/95 backdrop-blur-md border border-slate-700 shadow-2xl text-[11px] text-slate-200 font-mono leading-relaxed pointer-events-none ring-1 ring-cyan-500/20`}
                >
                  <div className="font-semibold text-cyan-400 mb-1 flex items-center space-x-1">
                    <span>Formula & Definition</span>
                  </div>
                  {formulaTooltip}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-baseline space-x-2 relative z-10">
        <span className={`text-2xl font-bold font-mono tracking-tight ${styles.text}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && <span className="text-xs font-mono text-slate-400">{unit}</span>}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-slate-400 font-sans truncate relative z-10">{subtitle}</p>
      )}
    </div>
  );
};
