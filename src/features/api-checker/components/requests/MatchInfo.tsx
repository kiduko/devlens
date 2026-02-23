import type { CapturedRequest } from '../../types';
import { EmptyState } from '../common/EmptyState';

interface MatchInfoProps {
  request: CapturedRequest;
}

export function MatchInfo({ request }: MatchInfoProps) {
  const match = request.matchResult;
  if (!match?.matched || !match.endpoint) {
    return <EmptyState title="No match found" />;
  }

  return (
    <div className="p-2 space-y-2">
      <div>
        <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Matched Endpoint</h4>
        <div className="space-y-0.5 text-xs">
          <div className="flex">
            <span className="text-gray-500 min-w-[100px] font-medium">Method:</span>
            <span className="text-gray-700 font-mono">{match.endpoint.method}</span>
          </div>
          <div className="flex">
            <span className="text-gray-500 min-w-[100px] font-medium">Path:</span>
            <span className="text-gray-700 font-mono">{match.endpoint.path}</span>
          </div>
          {match.endpoint.operationId && (
            <div className="flex">
              <span className="text-gray-500 min-w-[100px] font-medium">Operation:</span>
              <span className="text-gray-700">{match.endpoint.operationId}</span>
            </div>
          )}
          {match.endpoint.summary && (
            <div className="flex">
              <span className="text-gray-500 min-w-[100px] font-medium">Summary:</span>
              <span className="text-gray-700">{match.endpoint.summary}</span>
            </div>
          )}
          {match.endpoint.specTitle && (
            <div className="flex">
              <span className="text-gray-500 min-w-[100px] font-medium">Spec:</span>
              <span className="text-gray-700">{match.endpoint.specTitle}</span>
            </div>
          )}
          <div className="flex">
            <span className="text-gray-500 min-w-[100px] font-medium">Confidence:</span>
            <span className={`font-medium ${match.confidence === 'exact' ? 'text-green-600' : 'text-blue-600'}`}>
              {match.confidence}
            </span>
          </div>
          {match.endpoint.tags.length > 0 && (
            <div className="flex">
              <span className="text-gray-500 min-w-[100px] font-medium">Tags:</span>
              <span className="text-gray-700">{match.endpoint.tags.join(', ')}</span>
            </div>
          )}
        </div>
      </div>

      {Object.keys(match.pathParams).length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Path Parameters</h4>
          <div className="space-y-0.5">
            {Object.entries(match.pathParams).map(([key, value]) => (
              <div key={key} className="flex text-xs">
                <span className="text-gray-500 min-w-[100px] font-medium">{key}:</span>
                <span className="text-gray-700 font-mono">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
