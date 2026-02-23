import { create } from 'zustand';
import type { CapturedRequest } from '../types';

interface RequestState {
  requests: CapturedRequest[];
  selectedRequestId: string | null;

  addRequests: (requests: CapturedRequest[]) => void;
  setSelectedRequest: (id: string | null) => void;
  clearRequests: () => void;
}

export const useRequestStore = create<RequestState>((set) => ({
  requests: [],
  selectedRequestId: null,

  addRequests: (newRequests) =>
    set((state) => {
      // Upsert: update existing requests by id (for body updates), append new ones
      const requestMap = new Map(state.requests.map(r => [r.id, r]));
      for (const req of newRequests) {
        requestMap.set(req.id, req);
      }
      const updated = Array.from(requestMap.values());
      const trimmed = updated.length > 5000 ? updated.slice(-5000) : updated;
      return { requests: trimmed };
    }),

  setSelectedRequest: (id) => set({ selectedRequestId: id }),

  clearRequests: () => set({ requests: [], selectedRequestId: null }),
}));
