import { useMemo } from 'react';
import { useRequestStore } from '../stores/request-store';
import { useFilterStore, type MethodFilter, type StatusFilter, type MatchFilter } from '../stores/filter-store';
import type { CapturedRequest } from '../types';

export function useFilteredRequests(): CapturedRequest[] {
  const requests = useRequestStore((s) => s.requests);
  const { searchText, method, status, match } = useFilterStore();

  return useMemo(() => {
    return requests.filter((req) => {
      if (!matchesSearch(req, searchText)) return false;
      if (!matchesMethod(req, method)) return false;
      if (!matchesStatus(req, status)) return false;
      if (!matchesMatch(req, match)) return false;
      return true;
    });
  }, [requests, searchText, method, status, match]);
}

function matchesSearch(req: CapturedRequest, text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase();
  return (
    req.url.toLowerCase().includes(lower) ||
    req.path.toLowerCase().includes(lower) ||
    req.method.toLowerCase().includes(lower) ||
    String(req.statusCode).includes(lower)
  );
}

function matchesMethod(req: CapturedRequest, filter: MethodFilter): boolean {
  if (filter === 'ALL') return true;
  return req.method === filter;
}

function matchesStatus(req: CapturedRequest, filter: StatusFilter): boolean {
  if (filter === 'ALL') return true;
  const s = req.statusCode;
  switch (filter) {
    case '2xx': return s >= 200 && s < 300;
    case '3xx': return s >= 300 && s < 400;
    case '4xx': return s >= 400 && s < 500;
    case '5xx': return s >= 500 && s < 600;
    default: return true;
  }
}

function matchesMatch(req: CapturedRequest, filter: MatchFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'MATCHED') return req.matchResult?.matched === true;
  if (filter === 'UNMATCHED') return !req.matchResult?.matched;
  return true;
}
