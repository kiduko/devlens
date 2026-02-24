import { useCallback, useEffect } from 'react';
import { List, useListRef, type RowComponentProps } from 'react-window';
import { useFilteredRequests } from '../../hooks/useRequests';
import { useRequestStore } from '../../stores/request-store';
import { RequestRow } from './RequestRow';
import { EmptyState } from '../common/EmptyState';

type RowData = {
  requests: ReturnType<typeof useFilteredRequests>;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function RequestList() {
  const requests = useFilteredRequests();
  const selectedId = useRequestStore((s) => s.selectedRequestId);
  const setSelectedRequest = useRequestStore((s) => s.setSelectedRequest);
  const listRef = useListRef();

  // Auto-scroll to bottom when new requests arrive
  useEffect(() => {
    if (listRef.current && requests.length > 0) {
      listRef.current.scrollToRow({ index: requests.length - 1 });
    }
  }, [requests.length]);

  const handleSelect = useCallback((id: string) => {
    setSelectedRequest(selectedId === id ? null : id);
  }, [selectedId, setSelectedRequest]);

  if (requests.length === 0) {
    return <EmptyState title="No requests captured" description="Start recording to capture API calls" />;
  }

  // Use virtualized list for performance
  const ROW_HEIGHT = 32;

  return (
    <div className="flex-1 overflow-hidden">
      <div className="flex items-center px-3 py-1 border-b border-gray-100 bg-gray-50 text-[10px] text-gray-400 font-medium">
        <span className="w-14">Method</span>
        <span className="flex-1 ml-2">Path</span>
        <span className="w-10 text-right">Status</span>
        <span className="w-14 text-right">Time</span>
        <span className="w-4 text-center ml-1">M</span>
      </div>
      <List
        listRef={listRef}
        rowCount={requests.length}
        rowHeight={ROW_HEIGHT}
        overscanCount={20}
        rowComponent={RequestRowRenderer}
        rowProps={{ requests, selectedId, onSelect: handleSelect }}
      />
    </div>
  );
}

function RequestRowRenderer({ index, style, requests, selectedId, onSelect }: RowComponentProps<RowData>) {
  const request = requests[index];
  return (
    <div style={style}>
      <RequestRow
        request={request}
        selected={request.id === selectedId}
        onClick={() => onSelect(request.id)}
      />
    </div>
  );
}
