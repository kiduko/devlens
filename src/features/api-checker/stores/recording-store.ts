import { create } from 'zustand';

interface RecordingState {
  recording: boolean;
  tabId: number | null;

  setRecording: (recording: boolean, tabId: number | null) => void;
}

export const useRecordingStore = create<RecordingState>((set) => ({
  recording: false,
  tabId: null,

  setRecording: (recording, tabId) => set({ recording, tabId }),
}));
