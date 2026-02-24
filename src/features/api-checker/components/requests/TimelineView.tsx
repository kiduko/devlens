import { useCallback, useEffect } from 'react';
import { List, useListRef, type RowComponentProps } from 'react-window';
import { useTimelineItems, type TimelineItem } from '../../hooks/useTimelineItems';
import { useRequestStore } from '../../stores/request-store';
import { TimelineRow } from './TimelineRow';
import { TimelineGapRow } from './TimelineGapRow';
import { EmptyState } from '../common/EmptyState';

const REQUEST_HEIGHT = 48;
const GAP_HEIGHT = 28;

type RowData = {
  items: TimelineItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  firstRequestIdx: number;
  lastRequestIdx: number;
};

export function TimelineView() {
  const items = useTimelineItems();
  const selectedId = useRequestStore((s) => s.selectedRequestId);
  const setSelectedRequest = useRequestStore((s) => s.setSelectedRequest);
  const listRef = useListRef();

  // Auto-scroll to bottom when new items arrive
  useEffect(() => {
    if (listRef.current && items.length > 0) {
      listRef.current.scrollToRow({ index: items.length - 1 });
    }
  }, [items.length]);

  const handleSelect = useCallback((id: string) => {
    setSelectedRequest(selectedId === id ? null : id);
  }, [selectedId, setSelectedRequest]);

  const getItemSize = useCallback((index: number) => {
    return items[index].type === 'request' ? REQUEST_HEIGHT : GAP_HEIGHT;
  }, [items]);

  if (items.length === 0) {
    return <EmptyState title="No requests captured" description="Start recording to capture API calls" />;
  }

  // Precompute first/last request indices for rail endpoints
  const firstRequestIdx = items.findIndex(i => i.type === 'request');
  const lastRequestIdx = findLastIndex(items, i => i.type === 'request');

  return (
    <div className="flex-1 overflow-hidden">
      <List
        listRef={listRef}
        rowCount={items.length}
        rowHeight={getItemSize}
        overscanCount={20}
        rowComponent={TimelineItemRenderer}
        rowProps={{ items, selectedId, onSelect: handleSelect, firstRequestIdx, lastRequestIdx }}
      />
    </div>
  );
}

function findLastIndex<T>(arr: T[], pred: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i;
  }
  return -1;
}

function TimelineItemRenderer({ index, style, items, selectedId, onSelect, firstRequestIdx, lastRequestIdx }: RowComponentProps<RowData>) {
  const item = items[index];

  if (item.type === 'gap') {
    return (
      <div style={style}>
        <TimelineGapRow gapMs={item.gapMs} />
      </div>
    );
  }

  return (
    <div style={style}>
      <TimelineRow
        request={item.request}
        selected={item.request.id === selectedId}
        isFirst={index === firstRequestIdx}
        isLast={index === lastRequestIdx}
        onClick={() => onSelect(item.request.id)}
      />
    </div>
  );
}
