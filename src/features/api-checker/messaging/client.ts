import type { BackgroundMessage, BackgroundResponse, SidepanelMessage } from './protocol';

export function sendToBackground(message: BackgroundMessage): Promise<BackgroundResponse> {
  return chrome.runtime.sendMessage(message);
}

export function onBackgroundMessage(
  handler: (message: SidepanelMessage) => void,
): () => void {
  const listener = (message: unknown) => {
    const msg = message as SidepanelMessage;
    if (msg && typeof msg === 'object' && 'type' in msg) {
      handler(msg);
    }
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}
