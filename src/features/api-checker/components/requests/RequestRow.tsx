import { memo } from 'react';
import type { CapturedRequest } from '../../types';
import { MethodBadge, StatusBadge, MatchBadge } from '../common/Badge';
import { formatDuration } from '../../utils/formatters';

interface RequestRowProps {
  request: CapturedRequest;
  selected: boolean;
  onClick: () => void;
}

export const RequestRow = memo(function RequestRow({ request, selected, onClick }: RequestRowProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center px-3 py-1 text-left border-b border-gray-50 hover:bg-blue-50 transition-colors ${
        selected ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
      }`}
    >
      <span className="w-14 shrink-0">
        <MethodBadge method={request.method} />
      </span>
      <span className="flex-1 ml-2 text-xs text-gray-700 truncate font-mono" title={request.url}>
        {request.path}
      </span>
      <span className="w-10 text-right shrink-0">
        <StatusBadge status={request.statusCode} />
      </span>
      <span className="w-14 text-right text-[10px] text-gray-400 shrink-0">
        {formatDuration(request.duration)}
      </span>
      <span className="w-4 flex justify-center ml-1 shrink-0">
        <MatchBadge matched={request.matchResult?.matched ?? false} />
      </span>
    </button>
  );
});
