import { create } from 'zustand';
import type { ParsedSpec } from '../types';

interface SwaggerState {
  specs: ParsedSpec[];
  loading: boolean;
  error: string | null;

  addSpec: (spec: ParsedSpec) => void;
  removeSpec: (id: string) => void;
  setSpecs: (specs: ParsedSpec[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearSpecs: () => void;
}

export const useSwaggerStore = create<SwaggerState>((set) => ({
  specs: [],
  loading: false,
  error: null,

  addSpec: (spec) => set((state) => ({
    specs: [...state.specs, spec],
    error: null,
    loading: false,
  })),
  removeSpec: (id) => set((state) => ({
    specs: state.specs.filter((s) => s.id !== id),
  })),
  setSpecs: (specs) => set({ specs, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  clearSpecs: () => set({ specs: [], error: null }),
}));
