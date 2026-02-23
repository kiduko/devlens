import { memo } from 'react';
import type { CapturedRequest } from '../../types';
import { formatDuration } from '../../utils/formatters';

interface WaterfallRowProps {
  request: CapturedRequest;
  selected: boolean;
  startTime: number;
  totalSpan: number;
  onClick: () => void;
}

const statusBarColor: Record<string, { bg: string; border: string }> = {
  '2': { bg: 'bg-emerald-400', border: 'border-emerald-500' },
  '3': { bg: 'bg-blue-400', border: 'border-blue-500' },
  '4': { bg: 'bg-amber-400', border: 'border-amber-500' },
  '5': { bg: 'bg-red-400', border: 'border-red-500' },
};

const methodAbbrColors: Record<string, string> = {
  GET: 'text-blue-600',
  POST: 'text-green-600',
  PUT: 'text-amber-600',
  PATCH: 'text-orange-600',
  DELETE: 'text-red-600',
};

export const WaterfallRow = memo(function WaterfallRow({
  request, selected, startTime, totalSpan, onClick,
}: WaterfallRowProps) {
  const isUnmatched = (request.matchResult?.confidence ?? 'none') === 'none';
  const statusGroup = String(request.statusCode)[0];
  const colors = statusBarColor[statusGroup] || statusBarColor['2'];

  const leftPct = ((request.timestamp - startTime) / totalSpan) * 100;
  const widthPct = Math.max((request.duration / totalSpan) * 100, 0.4); // min 0.4% for visibility

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center text-left transition-colors h-full ${
        selected ? 'bg-blue-50' : 'hover:bg-gray-50/80'
      } ${isUnmatched ? 'opacity-45' : ''}`}
    >
      {/* Left: request info */}
      <div className="w-[140px] shrink-0 flex items-center gap-1 px-2 border-r border-gray-100 overflow-hidden">
        <span className={`text-[10px] font-bold shrink-0 w-7 ${methodAbbrColors[request.method] || 'text-gray-500'}`}>
          {request.method.slice(0, 3)}
        </span>
        <span className={`text-[11px] font-mono truncate ${selected ? 'text-gray-800' : 'text-gray-600'}`} title={request.url}>
          {request.path}
        </span>
      </div>

      {/* Middle: status */}
      <div className="w-9 shrink-0 text-center">
        <span className={`text-[10px] font-mono font-medium ${
          request.statusCode >= 400 ? 'text-red-500' : 'text-gray-500'
        }`}>
          {request.statusCode}
        </span>
      </div>

      {/* Right: waterfall bar area */}
      <div className="flex-1 h-full relative px-1">
        <div className="absolute inset-y-0 left-0 right-0">
          {/* Bar */}
          <div
            className="absolute top-1/2 -translate-y-1/2 flex items-center"
            style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: '2px' }}
          >
            {/* Wait portion (lighter) */}
            <div className={`h-2 rounded-l-sm ${colors.bg} opacity-40 border-l ${colors.border}`}
              style={{ width: '30%', minWidth: '1px' }}
            />
            {/* Download portion (solid) */}
            <div className={`h-2 rounded-r-sm ${colors.bg} border-r border-y ${colors.border}`}
              style={{ flex: 1, minWidth: '1px' }}
            />
            {/* Duration label */}
            <span className="ml-1 text-[9px] text-gray-400 font-mono tabular-nums whitespace-nowrap">
              {formatDuration(request.duration)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
});
