import { create } from 'zustand';
import type { DevLensSettings } from '../types';

const DEFAULT_SETTINGS: DevLensSettings = {
  autoSave: false,
  filePrefix: 'devlens_',
  saveFormat: 'original',
  enableHistory: false,
  folderMode: 'none',
  rootFolder: 'DevLens',
};

interface SettingsState {
  settings: DevLensSettings;
  loaded: boolean;
  setSettings: (settings: Partial<DevLensSettings>) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,

  setSettings: (partial) => {
    set((state) => ({
      settings: { ...state.settings, ...partial },
    }));
    get().saveSettings();
  },

  loadSettings: async () => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.get('devlensSettings', (result) => {
        if (result.devlensSettings) {
          set({ settings: { ...DEFAULT_SETTINGS, ...result.devlensSettings }, loaded: true });
        } else {
          set({ loaded: true });
        }
        resolve();
      });
    });
  },

  saveSettings: () => {
    const { settings } = get();
    chrome.storage.local.set({ devlensSettings: settings });
  },
}));
