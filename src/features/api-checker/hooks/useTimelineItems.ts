import { useMemo } from 'react';
import { useFilteredRequests } from './useRequests';
import type { CapturedRequest } from '../types';

const GAP_THRESHOLD_MS = 3000;

export type TimelineItem =
  | { type: 'request'; request: CapturedRequest }
  | { type: 'gap'; gapMs: number };

export function useTimelineItems(): TimelineItem[] {
  const requests = useFilteredRequests();

  return useMemo(() => {
    const items: TimelineItem[] = [];

    for (let i = 0; i < requests.length; i++) {
      if (i > 0) {
        const gap = requests[i].timestamp - requests[i - 1].timestamp;
        if (gap >= GAP_THRESHOLD_MS) {
          items.push({ type: 'gap', gapMs: gap });
        }
      }
      items.push({ type: 'request', request: requests[i] });
    }

    return items;
  }, [requests]);
}
