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
      const updated = [...state.requests, ...newRequests];
      // Ring buffer: keep max 5000
      const trimmed = updated.length > 5000 ? updated.slice(-5000) : updated;
      return { requests: trimmed };
    }),

  setSelectedRequest: (id) => set({ selectedRequestId: id }),

  clearRequests: () => set({ requests: [], selectedRequestId: null }),
}));
