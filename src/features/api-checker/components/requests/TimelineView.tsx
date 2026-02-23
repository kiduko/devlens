import { useCallback, useRef, useEffect } from 'react';
import { VariableSizeList as List } from 'react-window';
import { useTimelineItems, type TimelineItem } from '../../hooks/useTimelineItems';
import { useRequestStore } from '../../stores/request-store';
import { TimelineRow } from './TimelineRow';
import { TimelineGapRow } from './TimelineGapRow';
import { EmptyState } from '../common/EmptyState';

const REQUEST_HEIGHT = 48;
const GAP_HEIGHT = 28;

export function TimelineView() {
  const items = useTimelineItems();
  const selectedId = useRequestStore((s) => s.selectedRequestId);
  const setSelectedRequest = useRequestStore((s) => s.setSelectedRequest);
  const listRef = useRef<List>(null);

  // Auto-scroll to bottom when new items arrive
  useEffect(() => {
    if (listRef.current && items.length > 0) {
      listRef.current.scrollToItem(items.length - 1);
    }
  }, [items.length]);

  // Reset cached sizes when items change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }
  }, [items]);

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
        ref={listRef}
        height={400}
        width="100%"
        itemCount={items.length}
        itemSize={getItemSize}
        overscanCount={20}
        itemData={{ items, selectedId, onSelect: handleSelect, firstRequestIdx, lastRequestIdx }}
      >
        {TimelineItemRenderer}
      </List>
    </div>
  );
}

function findLastIndex<T>(arr: T[], pred: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i;
  }
  return -1;
}

interface RendererData {
  items: TimelineItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  firstRequestIdx: number;
  lastRequestIdx: number;
}

function TimelineItemRenderer({ index, style, data }: {
  index: number;
  style: React.CSSProperties;
  data: RendererData;
}) {
  const item = data.items[index];

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
        selected={item.request.id === data.selectedId}
        isFirst={index === data.firstRequestIdx}
        isLast={index === data.lastRequestIdx}
        onClick={() => data.onSelect(item.request.id)}
      />
    </div>
  );
}
