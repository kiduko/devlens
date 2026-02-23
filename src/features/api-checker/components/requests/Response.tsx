import type { CapturedRequest } from '../../types';
import { JsonViewer } from '../common/JsonViewer';
import { EmptyState } from '../common/EmptyState';

interface ResponseProps {
  request: CapturedRequest;
}

export function Response({ request }: ResponseProps) {
  if (!request.responseBody) {
    return <EmptyState title="No response body" />;
  }

  return (
    <div className="p-2">
      {request.responseBodyTruncated && (
        <p className="text-[10px] text-amber-500 mb-1">Response body truncated (exceeds 1MB)</p>
      )}
      <JsonViewer content={request.responseBody} maxHeight="220px" />
    </div>
  );
}
