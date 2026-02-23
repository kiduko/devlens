import type { CapturedRequest } from '../../types';
import { JsonViewer } from '../common/JsonViewer';
import { EmptyState } from '../common/EmptyState';
import { parseQueryString } from '../../utils/url';

interface PayloadProps {
  request: CapturedRequest;
}

export function Payload({ request }: PayloadProps) {
  const queryParams = parseQueryString(request.url);
  const hasQuery = Object.keys(queryParams).length > 0;
  const hasBody = !!request.requestBody;

  if (!hasQuery && !hasBody) {
    return <EmptyState title="No payload" />;
  }

  return (
    <div className="p-2 space-y-3">
      {hasQuery && (
        <div>
          <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Query Parameters</h4>
          <div className="space-y-0.5">
            {Object.entries(queryParams).map(([key, value]) => (
              <div key={key} className="flex text-xs">
                <span className="text-gray-500 min-w-[100px] shrink-0 font-medium">{key}:</span>
                <span className="text-gray-700 break-all font-mono">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {hasBody && (
        <div>
          <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Request Body</h4>
          <JsonViewer content={request.requestBody!} />
        </div>
      )}
    </div>
  );
}
