import type { CapturedRequest } from '../../types';

interface HeadersProps {
  request: CapturedRequest;
}

export function Headers({ request }: HeadersProps) {
  return (
    <div className="p-2 space-y-3">
      <HeaderSection title="General" entries={[
        ['Request URL', request.url],
        ['Request Method', request.method],
        ['Status Code', `${request.statusCode} ${request.statusText}`],
      ]} />
      <HeaderSection title="Response Headers" entries={Object.entries(request.responseHeaders)} />
      <HeaderSection title="Request Headers" entries={Object.entries(request.requestHeaders)} />
    </div>
  );
}

function HeaderSection({ title, entries }: { title: string; entries: [string, string][] }) {
  if (entries.length === 0) return null;

  return (
    <div>
      <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1">{title}</h4>
      <div className="space-y-0.5">
        {entries.map(([key, value], i) => (
          <div key={`${key}-${i}`} className="flex text-xs">
            <span className="text-gray-500 min-w-[120px] shrink-0 font-medium">{key}:</span>
            <span className="text-gray-700 break-all font-mono">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
