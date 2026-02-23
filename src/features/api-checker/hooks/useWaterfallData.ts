import { useMemo } from 'react';
import { useFilteredRequests } from './useRequests';
import type { CapturedRequest } from '../types';

export interface WaterfallData {
  requests: CapturedRequest[];
  startTime: number;
  endTime: number;
  totalSpan: number;
}

export function useWaterfallData(): WaterfallData {
  const requests = useFilteredRequests();

  return useMemo(() => {
    if (requests.length === 0) {
      return { requests, startTime: 0, endTime: 0, totalSpan: 0 };
    }

    let startTime = requests[0].timestamp;
    let endTime = requests[0].timestamp + requests[0].duration;

    for (const req of requests) {
      if (req.timestamp < startTime) startTime = req.timestamp;
      const end = req.timestamp + req.duration;
      if (end > endTime) endTime = end;
    }

    const totalSpan = Math.max(endTime - startTime, 1);

    return { requests, startTime, endTime, totalSpan };
  }, [requests]);
}

/** Compute nice tick intervals for the time scale header */
export function computeTicks(totalSpan: number, widthPx: number): { offsetPct: number; label: string }[] {
  if (totalSpan <= 0 || widthPx <= 0) return [];

  // Target roughly 1 tick per 60-80px
  const targetTickCount = Math.max(2, Math.floor(widthPx / 70));
  const rawInterval = totalSpan / targetTickCount;

  // Snap to nice intervals
  const niceIntervals = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 30000, 60000];
  let interval = niceIntervals[niceIntervals.length - 1];
  for (const ni of niceIntervals) {
    if (ni >= rawInterval) {
      interval = ni;
      break;
    }
  }

  const ticks: { offsetPct: number; label: string }[] = [];
  for (let t = 0; t <= totalSpan; t += interval) {
    ticks.push({
      offsetPct: (t / totalSpan) * 100,
      label: formatTickLabel(t),
    });
  }
  return ticks;
}

function formatTickLabel(ms: number): string {
  if (ms === 0) return '0';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return s > 0 ? `${m}m${s}s` : `${m}m`;
}
