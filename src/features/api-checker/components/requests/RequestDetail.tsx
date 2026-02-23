import { useRequestStore } from '../../stores/request-store';
import { Tabs } from '../common/Tabs';
import { Headers } from './Headers';
import { Payload } from './Payload';
import { Cookies } from './Cookies';
import { Response } from './Response';
import { MatchInfo } from './MatchInfo';
import { EmptyState } from '../common/EmptyState';

export function RequestDetail() {
  const selectedId = useRequestStore((s) => s.selectedRequestId);
  const request = useRequestStore((s) =>
    s.requests.find((r) => r.id === s.selectedRequestId) ?? null,
  );

  if (!selectedId || !request) {
    return (
      <div className="border-t border-gray-200">
        <EmptyState title="Select a request to view details" />
      </div>
    );
  }

  const tabs = [
    { id: 'headers', label: 'Headers', content: <Headers request={request} /> },
    { id: 'payload', label: 'Payload', content: <Payload request={request} /> },
    { id: 'cookies', label: `Cookies${request.cookies.length ? ` (${request.cookies.length})` : ''}`, content: <Cookies request={request} /> },
    { id: 'response', label: 'Response', content: <Response request={request} /> },
    ...(request.matchResult?.matched
      ? [{ id: 'match', label: 'Match', content: <MatchInfo request={request} /> }]
      : []),
  ];

  return (
    <div className="border-t border-gray-200 h-[280px]">
      <Tabs tabs={tabs} />
    </div>
  );
}
