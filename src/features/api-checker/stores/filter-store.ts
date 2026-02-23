import { create } from 'zustand';

export type MethodFilter = 'ALL' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type StatusFilter = 'ALL' | '2xx' | '3xx' | '4xx' | '5xx';
export type MatchFilter = 'ALL' | 'MATCHED' | 'UNMATCHED';
export type ViewMode = 'list' | 'timeline' | 'waterfall';

interface FilterState {
  searchText: string;
  method: MethodFilter;
  status: StatusFilter;
  match: MatchFilter;
  viewMode: ViewMode;

  setSearchText: (text: string) => void;
  setMethod: (method: MethodFilter) => void;
  setStatus: (status: StatusFilter) => void;
  setMatch: (match: MatchFilter) => void;
  setViewMode: (mode: ViewMode) => void;
  resetFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  searchText: '',
  method: 'ALL',
  status: 'ALL',
  match: 'ALL',
  viewMode: 'list',

  setSearchText: (searchText) => set({ searchText }),
  setMethod: (method) => set({ method }),
  setStatus: (status) => set({ status }),
  setMatch: (match) => set({ match }),
  setViewMode: (viewMode) => set({ viewMode }),
  resetFilters: () => set({ searchText: '', method: 'ALL', status: 'ALL', match: 'ALL' }),
}));
