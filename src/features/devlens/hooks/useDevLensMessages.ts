import { useEffect, useRef } from 'react';
import { useDevLensStore } from '../stores/devlens-store';
import { useSettingsStore } from '../stores/settings-store';
import { analyzeImageUrl } from '../services/url-param-analyzer';
import { toast } from '../../../shared/components/Toast';
import type { DevLensMessage, DevLensPanelMessage } from '../types';

export function useDevLensMessages() {
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const store = useDevLensStore;
  const settings = useSettingsStore;

  useEffect(() => {
    const port = chrome.runtime.connect({ name: 'devlens-sidepanel' });
    portRef.current = port;

    port.onMessage.addListener((msg: DevLensMessage) => {
      const state = store.getState();

      if (msg.action === 'imageLoading') {
        state.setCurrentSrc(msg.src);
        state.setViewState('loading');
      }
      if (msg.action === 'imageData') {
        state.setImageData(msg.data);
        const params = analyzeImageUrl(msg.data.src);
        state.setDetectedUrlParams(params);
        const s = settings.getState();
        state.addToHistory(msg.data.src, s.settings.enableHistory);
      }
      if (msg.action === 'imageError') {
        state.setImageError(msg.src, msg.error);
        const s = settings.getState();
        state.addToHistory(msg.src, s.settings.enableHistory);
      }
      if (msg.action === 'videoLoading') {
        state.setViewState('loading');
      }
      if (msg.action === 'videoData') {
        state.setVideoData(msg.data);
      }
      if (msg.action === 'videoProgress') {
        state.setVideoProgress({
          stage: msg.stage as any,
          percent: msg.percent,
          message: msg.message,
        });
      }
      if (msg.action === 'downloadComplete') {
        toast(`저장됨: ${msg.path}`);
      }
    });

    port.onDisconnect.addListener(() => {
      portRef.current = null;
    });

    return () => {
      try { port.disconnect(); } catch { /* ignore */ }
    };
  }, []);

  const sendMessage = (msg: DevLensPanelMessage) => {
    portRef.current?.postMessage(msg);
  };

  return { sendMessage, portRef };
}
