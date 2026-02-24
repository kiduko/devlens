import { useCallback, useEffect, useState } from 'react';
import { List, useListRef, type RowComponentProps } from 'react-window';
import { useWaterfallData, computeTicks } from '../../hooks/useWaterfallData';
import { useRequestStore } from '../../stores/request-store';
import { WaterfallRow } from './WaterfallRow';
import { EmptyState } from '../common/EmptyState';

const ROW_HEIGHT = 24;

type RowData = {
  requests: ReturnType<typeof useWaterfallData>['requests'];
  selectedId: string | null;
  onSelect: (id: string) => void;
  startTime: number;
  totalSpan: number;
};

export function WaterfallView() {
  const { requests, startTime, totalSpan } = useWaterfallData();
  const selectedId = useRequestStore((s) => s.selectedRequestId);
  const setSelectedRequest = useRequestStore((s) => s.setSelectedRequest);
  const listRef = useListRef();
  const waterfallRef = useState<HTMLDivElement | null>(null);
  const [barWidth, setBarWidth] = useState(300);

  // Measure waterfall area width for tick computation
  useEffect(() => {
    const el = waterfallRef[0];
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setBarWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [waterfallRef[0]]);

  // Auto-scroll to bottom
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

  const ticks = computeTicks(totalSpan, barWidth);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Scale header */}
      <div className="flex items-end border-b border-gray-200 bg-gray-50/80 shrink-0 h-5">
        {/* Info column header */}
        <div className="w-[140px] shrink-0 border-r border-gray-100" />
        {/* Status column header */}
        <div className="w-9 shrink-0" />
        {/* Time scale */}
        <div ref={(el) => { if (el !== waterfallRef[0]) waterfallRef[1](el); }} className="flex-1 relative px-1">
          {ticks.map((tick, i) => (
            <div
              key={i}
              className="absolute bottom-0 flex flex-col items-center"
              style={{ left: `${tick.offsetPct}%` }}
            >
              <span className="text-[8px] text-gray-400 font-mono tabular-nums -translate-x-1/2 whitespace-nowrap">
                {tick.label}
              </span>
              <div className="w-px h-0.5 bg-gray-300" />
            </div>
          ))}
        </div>
      </div>

      {/* Rows + grid */}
      <div className="flex-1 overflow-hidden relative">
        {/* Vertical grid lines behind rows */}
        <div className="absolute inset-0 flex pointer-events-none">
          <div className="w-[140px] shrink-0" />
          <div className="w-9 shrink-0" />
          <div className="flex-1 relative px-1">
            {ticks.map((tick, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-px bg-gray-100"
                style={{ left: `${tick.offsetPct}%` }}
              />
            ))}
          </div>
        </div>

        <List
          listRef={listRef}
          rowCount={requests.length}
          rowHeight={ROW_HEIGHT}
          overscanCount={30}
          rowComponent={WaterfallRowRenderer}
          rowProps={{ requests, selectedId, onSelect: handleSelect, startTime, totalSpan }}
        />
      </div>
    </div>
  );
}

function WaterfallRowRenderer({ index, style, requests, selectedId, onSelect, startTime, totalSpan }: RowComponentProps<RowData>) {
  const request = requests[index];
  return (
    <div style={style}>
      <WaterfallRow
        request={request}
        selected={request.id === selectedId}
        startTime={startTime}
        totalSpan={totalSpan}
        onClick={() => onSelect(request.id)}
      />
    </div>
  );
}
