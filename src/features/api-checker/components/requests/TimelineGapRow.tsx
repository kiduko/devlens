import { memo } from 'react';
import { formatGapDuration } from '../../utils/formatters';

interface TimelineGapRowProps {
  gapMs: number;
}

export const TimelineGapRow = memo(function TimelineGapRow({ gapMs }: TimelineGapRowProps) {
  return (
    <div className="flex items-center h-full">
      {/* Timeline rail - dotted segment */}
      <div className="w-9 shrink-0 flex flex-col items-center">
        <div className="w-0.5 flex-1 bg-transparent"
          style={{ backgroundImage: 'linear-gradient(to bottom, #d1d5db 4px, transparent 4px)', backgroundSize: '2px 8px', backgroundRepeat: 'repeat-y', backgroundPosition: 'center' }}
        />
      </div>
      {/* Gap pill */}
      <div className="flex-1 flex items-center pr-3">
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/60">
          <svg width="10" height="10" viewBox="0 0 10 10" className="text-amber-400" fill="none" stroke="currentColor" strokeWidth="1.2">
            <circle cx="5" cy="5" r="4" />
            <line x1="5" y1="2.5" x2="5" y2="5" />
            <line x1="5" y1="5" x2="6.5" y2="6.5" />
          </svg>
          <span className="text-[10px] font-medium text-amber-600 tabular-nums">
            {formatGapDuration(gapMs)}
          </span>
        </div>
      </div>
    </div>
  );
});
