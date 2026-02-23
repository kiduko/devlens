import type { ReactNode } from 'react';
import { useFilterStore, type ViewMode } from '../../stores/filter-store';

const modes: { value: ViewMode; label: string; icon: ReactNode }[] = [
  {
    value: 'list',
    label: 'List',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="1" y1="3" x2="13" y2="3" />
        <line x1="1" y1="7" x2="13" y2="7" />
        <line x1="1" y1="11" x2="13" y2="11" />
      </svg>
    ),
  },
  {
    value: 'timeline',
    label: 'Timeline',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="4" y1="1" x2="4" y2="13" />
        <circle cx="4" cy="3" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="4" cy="7" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="4" cy="11" r="1.5" fill="currentColor" stroke="none" />
        <line x1="7" y1="3" x2="12" y2="3" />
        <line x1="7" y1="7" x2="12" y2="7" />
        <line x1="7" y1="11" x2="12" y2="11" />
      </svg>
    ),
  },
  {
    value: 'waterfall',
    label: 'Waterfall',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
        {/* Horizontal bars at different offsets like DevTools waterfall */}
        <rect x="1" y="2" width="5" height="2" rx="0.5" fill="currentColor" stroke="none" />
        <rect x="3" y="6" width="7" height="2" rx="0.5" fill="currentColor" stroke="none" />
        <rect x="6" y="10" width="4" height="2" rx="0.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

export function ViewModeToggle() {
  const viewMode = useFilterStore((s) => s.viewMode);
  const setViewMode = useFilterStore((s) => s.setViewMode);

  return (
    <div className="flex items-center rounded border border-gray-300 overflow-hidden">
      {modes.map((mode) => (
        <button
          key={mode.value}
          onClick={() => setViewMode(mode.value)}
          title={mode.label}
          className={`p-1 transition-colors ${
            viewMode === mode.value
              ? 'bg-blue-100 text-blue-600'
              : 'bg-white text-gray-400 hover:text-gray-600'
          }`}
        >
          {mode.icon}
        </button>
      ))}
    </div>
  );
}
