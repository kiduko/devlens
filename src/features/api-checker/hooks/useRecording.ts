import { useCallback } from 'react';
import { useRecordingStore } from '../stores/recording-store';
import { useRequestStore } from '../stores/request-store';
import { sendToBackground } from '../messaging/client';

export function useRecording() {
  const { recording, tabId, setRecording } = useRecordingStore();

  const startRecording = useCallback(async () => {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const response = await sendToBackground({ type: 'START_RECORDING', tabId: tab.id });
    if (response.success) {
      setRecording(true, tab.id);
    } else {
      console.error('Failed to start recording:', response.error);
    }
  }, [setRecording]);

  const stopRecording = useCallback(async () => {
    if (tabId === null) return;
    const response = await sendToBackground({ type: 'STOP_RECORDING', tabId });
    if (response.success) {
      setRecording(false, null);
    }
  }, [tabId, setRecording]);

  const clearRequests = useCallback(async () => {
    await sendToBackground({ type: 'CLEAR_REQUESTS' });
    useRequestStore.getState().clearRequests();
  }, []);

  return { recording, tabId, startRecording, stopRecording, clearRequests };
}
