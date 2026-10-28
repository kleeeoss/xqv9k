import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Lock } from 'lucide-react';

interface MonthLockedDatePickerProps {
  value: string; // "YYYY-MM-DD" strictly within 2026-01-01 to 2026-01-31
  onChange: (date: string) => void;
  disabled?: boolean;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// In January 2026, Jan 1 is a Thursday (index 4 in Sun=0).
// Total days in January: 31.
const TOTAL_JANUARY_DAYS = 31;
const PREV_MONTH_PADDING = [28, 29, 30, 31];
// Total grid cells = 35 (5 rows of 7 = 35). Exactly 5 rows!

export const MonthLockedDatePicker: React.FC<MonthLockedDatePickerProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click or escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedDay = parseInt(value.slice(8, 10), 10);

  const handleSelectDay = (day: number) => {
    const formatted = `2026-01-${String(day).padStart(2, '0')}`;
    onChange(formatted);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select Delivery Date (Locked to January 2026)"
        aria-expanded={isOpen}
        className="flex items-center space-x-2 bg-[#0C1017] hover:bg-[#121824] border border-slate-700/80 hover:border-slate-500 rounded-sm px-2.5 py-1 text-xs font-mono text-white transition-all focus:outline-none focus:border-cyan-500 shadow-sm"
        data-testid="month-locked-date-trigger"
      >
        <Calendar className="w-3.5 h-3.5 text-cyan-400" />
        <span className="font-semibold text-slate-100 tabular-nums">{value}</span>
        <span className="text-[10px] text-slate-400 uppercase px-1 py-0.2 rounded-sm bg-[#161D2B] border border-slate-800">
          Jan '26
        </span>
      </button>

      {/* Month-Locked Popover Calendar */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="absolute left-0 top-8 z-50 w-72 rounded-sm bg-[#0B0E14] border border-slate-700 shadow-2xl p-3 ring-1 ring-slate-800"
          data-testid="month-locked-calendar-popover"
        >
          {/* Locked Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <button
              type="button"
              disabled
              title="Navigation locked: historical evaluation scope is January 2026 only"
              className="p-1 rounded-sm text-slate-600 cursor-not-allowed opacity-30"
              aria-label="Previous month disabled"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center space-x-1.5">
              <Lock className="w-3 h-3 text-cyan-400" />
              <span className="text-xs font-bold font-mono text-white uppercase tracking-wider">
                January 2026
              </span>
            </div>

            <button
              type="button"
              disabled
              title="Navigation locked: historical evaluation scope is January 2026 only"
              className="p-1 rounded-sm text-slate-600 cursor-not-allowed opacity-30"
              aria-label="Next month disabled"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-2 text-[10px] font-mono text-cyan-400/90 text-center bg-[#070A10] border border-cyan-900/40 rounded-sm py-0.5 mb-2">
            Scope constrained: Jan 1–31, 2026
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DAYS_OF_WEEK.map((d) => (
              <span key={d} className="text-[10px] font-mono font-medium text-slate-500 uppercase">
                {d}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1" data-testid="calendar-days-grid">
            {/* Dec 2025 Padding Days (Disabled) */}
            {PREV_MONTH_PADDING.map((day) => (
              <button
                key={`prev-${day}`}
                type="button"
                disabled
                tabIndex={-1}
                aria-disabled="true"
                className="h-6 text-xs font-mono text-slate-700 cursor-not-allowed rounded-sm opacity-25 pointer-events-none tabular-nums"
              >
                {day}
              </button>
            ))}

            {/* January 1-31 Active Days */}
            {Array.from({ length: TOTAL_JANUARY_DAYS }, (_, i) => i + 1).map((day) => {
              const isSelected = selectedDay === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  aria-label={`Select January ${day}, 2026`}
                  aria-selected={isSelected}
                  data-testid={`calendar-day-${day}`}
                  className={`h-6 text-xs font-mono rounded-sm transition-all flex items-center justify-center font-medium tabular-nums ${
                    isSelected
                      ? 'bg-cyan-600 text-white font-bold shadow-sm ring-1 ring-cyan-400'
                      : 'text-slate-300 hover:bg-[#161D2B] hover:text-white'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
