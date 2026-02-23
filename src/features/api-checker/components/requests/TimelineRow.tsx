import { memo } from 'react';
import type { CapturedRequest } from '../../types';
import { MethodBadge, StatusBadge } from '../common/Badge';
import { formatTimestamp, formatDuration } from '../../utils/formatters';

interface TimelineRowProps {
  request: CapturedRequest;
  selected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onClick: () => void;
}

export const TimelineRow = memo(function TimelineRow({ request, selected, isFirst, isLast, onClick }: TimelineRowProps) {
  const confidence = request.matchResult?.confidence ?? 'none';
  const isUnmatched = confidence === 'none';

  const dotClass =
    confidence === 'exact'
      ? 'bg-green-400 ring-[3px] ring-green-400/20'
      : confidence === 'pattern'
        ? 'bg-blue-400 ring-[3px] ring-blue-400/20'
        : 'bg-gray-300 ring-[3px] ring-gray-100';

  const railColor =
    confidence === 'exact'
      ? 'bg-green-200'
      : confidence === 'pattern'
        ? 'bg-blue-200'
        : 'bg-gray-200';

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-stretch text-left transition-colors group ${
        selected
          ? 'bg-blue-50'
          : 'hover:bg-gray-50'
      } ${isUnmatched ? 'opacity-45' : ''}`}
    >
      {/* Timeline rail */}
      <div className="w-9 shrink-0 flex flex-col items-center">
        {isFirst
          ? <div className="flex-1" />
          : <div className={`w-0.5 flex-1 ${railColor}`} />
        }
        <div className={`w-3 h-3 rounded-full shrink-0 z-10 ${dotClass}`} />
        {isLast
          ? <div className="flex-1" />
          : <div className={`w-0.5 flex-1 ${railColor}`} />
        }
      </div>

      {/* Content card */}
      <div className={`flex-1 min-w-0 flex items-center gap-2 py-1.5 pr-3 border-b ${
        selected ? 'border-blue-100' : 'border-gray-100 group-hover:border-gray-200'
      }`}>
        {/* Left: info */}
        <div className="flex-1 min-w-0">
          {/* Top line: method + path */}
          <div className="flex items-center gap-1.5">
            <MethodBadge method={request.method} />
            <span className="text-xs text-gray-700 font-mono truncate" title={request.url}>
              {request.path}
            </span>
          </div>
          {/* Bottom line: timestamp + status + duration */}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-gray-400 font-mono tabular-nums">
              {formatTimestamp(request.timestamp)}
            </span>
            <StatusBadge status={request.statusCode} />
            <span className="text-[10px] text-gray-400 tabular-nums">
              {formatDuration(request.duration)}
            </span>
          </div>
        </div>

        {/* Right: match indicator */}
        {!isUnmatched && (
          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
            confidence === 'exact'
              ? 'bg-green-50 text-green-600'
              : 'bg-blue-50 text-blue-600'
          }`}>
            {confidence}
          </span>
        )}
      </div>
    </button>
  );
});
