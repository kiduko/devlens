import { create } from 'zustand';
import type { ImageData, VideoData, VideoProgress, HistoryItem, ViewState, DetectedUrlParam } from '../types';

interface DevLensState {
  viewState: ViewState;
  currentImageData: ImageData | null;
  currentVideoData: VideoData | null;
  currentSrc: string | null;
  originalSrc: string | null;
  detectedUrlParams: DetectedUrlParam[];
  previousImageData: ImageData | null;
  pendingCompare: boolean;
  videoProgress: VideoProgress | null;
  imageHistory: HistoryItem[];

  setViewState: (state: ViewState) => void;
  setImageData: (data: ImageData) => void;
  setImageError: (src: string, error: string) => void;
  setVideoData: (data: VideoData) => void;
  setVideoProgress: (progress: VideoProgress) => void;
  setCurrentSrc: (src: string) => void;
  setOriginalSrc: (src: string) => void;
  setDetectedUrlParams: (params: DetectedUrlParam[]) => void;
  setPreviousImageData: (data: ImageData | null) => void;
  setPendingCompare: (pending: boolean) => void;
  addToHistory: (src: string, enableHistory: boolean) => void;
  clearHistory: () => void;
  reset: () => void;
}

const MAX_HISTORY = 20;

export const useDevLensStore = create<DevLensState>((set, get) => ({
  viewState: 'empty',
  currentImageData: null,
  currentVideoData: null,
  currentSrc: null,
  originalSrc: null,
  detectedUrlParams: [],
  previousImageData: null,
  pendingCompare: false,
  videoProgress: null,
  imageHistory: [],

  setViewState: (viewState) => set({ viewState }),

  setImageData: (data) => {
    const state = get();
    const isNewImage = !state.originalSrc ||
      !state.detectedUrlParams.length ||
      state.detectedUrlParams.every(p => p.value === p.originalValue);

    set({
      currentImageData: data,
      currentVideoData: null,
      currentSrc: data.src,
      viewState: 'image',
      ...(isNewImage ? {
        originalSrc: data.src,
        ...(state.pendingCompare ? {} : { previousImageData: null }),
      } : {}),
    });
  },

  setImageError: (src, error) => set({
    currentImageData: { src, error } as any,
    currentVideoData: null,
    currentSrc: src,
    viewState: 'image',
  }),

  setVideoData: (data) => set({
    currentVideoData: data,
    currentImageData: null,
    currentSrc: data.src,
    viewState: 'video',
  }),

  setVideoProgress: (progress) => set({ videoProgress: progress }),
  setCurrentSrc: (src) => set({ currentSrc: src }),
  setOriginalSrc: (src) => set({ originalSrc: src }),
  setDetectedUrlParams: (params) => set({ detectedUrlParams: params }),
  setPreviousImageData: (data) => set({ previousImageData: data }),
  setPendingCompare: (pending) => set({ pendingCompare: pending }),

  addToHistory: (src, enableHistory) => {
    if (!enableHistory) return;
    set((state) => {
      const history = state.imageHistory.filter(h => h.src !== src);
      history.unshift({ src });
      if (history.length > MAX_HISTORY) history.pop();
      return { imageHistory: history };
    });
  },

  clearHistory: () => set({ imageHistory: [] }),

  reset: () => set({
    viewState: 'empty',
    currentImageData: null,
    currentVideoData: null,
    currentSrc: null,
    originalSrc: null,
    detectedUrlParams: [],
    previousImageData: null,
    pendingCompare: false,
    videoProgress: null,
  }),
}));
