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

const variantStyles: Record<
  string,
  {
    border: string;
    text: string;
    badge: string;
    accent: string;
  }
> = {
  cyan: {
    border: 'border-slate-800 hover:border-cyan-500/40',
    text: 'text-cyan-400',
    badge: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/50',
    accent: 'bg-cyan-500',
  },
  emerald: {
    border: 'border-slate-800 hover:border-emerald-500/40',
    text: 'text-emerald-400',
    badge: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50',
    accent: 'bg-emerald-500',
  },
  amber: {
    border: 'border-slate-800 hover:border-amber-500/40',
    text: 'text-amber-400',
    badge: 'bg-amber-950/60 text-amber-300 border-amber-800/50',
    accent: 'bg-amber-500',
  },
  rose: {
    border: 'border-slate-800 hover:border-rose-500/40',
    text: 'text-rose-400',
    badge: 'bg-rose-950/60 text-rose-300 border-rose-800/50',
    accent: 'bg-rose-500',
  },
  indigo: {
    border: 'border-slate-800 hover:border-indigo-500/40',
    text: 'text-indigo-400',
    badge: 'bg-indigo-950/60 text-indigo-300 border-indigo-800/50',
    accent: 'bg-indigo-500',
  },
  slate: {
    border: 'border-slate-800 hover:border-slate-700',
    text: 'text-slate-100',
    badge: 'bg-slate-900 text-slate-300 border-slate-700',
    accent: 'bg-slate-500',
  },
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  formulaTooltip,
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
      className={`relative ${
        showTooltip ? 'z-40' : 'z-0'
      } overflow-visible rounded-md bg-obsidian-900 border ${
        styles.border
      } p-3 transition-colors shadow-sm`}
      data-testid={`metric-card-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
    >
      {/* Subtle 2px Top Accent Border */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${styles.accent} opacity-70`} />

      {/* Header Row: Title, Badge, and Info Button */}
      <div className="flex items-center justify-between mb-1.5 relative z-10">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </span>

        <div className="flex items-center space-x-1.5">
          {badge && (
            <span
              className={`text-[9px] font-mono uppercase px-1 py-0.2 rounded border ${styles.badge}`}
            >
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

              {/* 100% Solid Opaque Tooltip - Zero Transparency, Zero Bleed */}
              {showTooltip && (
                <div
                  role="tooltip"
                  className={`absolute ${
                    placement === 'left' ? 'left-0' : 'right-0'
                  } top-7 z-50 w-64 sm:w-72 max-w-[calc(100vw-2.5rem)] p-3 rounded-md bg-[#0B0E14] border border-slate-700 shadow-2xl text-[11px] text-slate-200 font-mono leading-relaxed pointer-events-none ring-1 ring-cyan-500/20`}
                >
                  <div className="font-semibold text-cyan-400 mb-1 flex items-center space-x-1 border-b border-slate-800 pb-1">
                    <span>Formula & Definition</span>
                  </div>
                  <div className="text-slate-300 mt-1">
                    {formulaTooltip}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metric Numeric Value & Unit (Tabular Numerals) */}
      <div className="flex items-baseline space-x-1.5 relative z-10">
        <span
          className={`text-xl font-bold font-mono tabular-nums tracking-tight ${styles.text}`}
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && <span className="text-[10px] font-mono text-slate-400">{unit}</span>}
      </div>

      {/* Subtitle / Context Note */}
      {subtitle && (
        <p className="mt-1 text-[10px] font-mono text-slate-400 truncate relative z-10">
          {subtitle}
        </p>
      )}
    </div>
  );
};
