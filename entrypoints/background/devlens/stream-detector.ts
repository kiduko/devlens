const detectedStreams = new Map<number, { url: string; type: string; timestamp: number }[]>();

export function initStreamDetector(sendToPanel: (msg: any) => void): void {
  chrome.webRequest.onCompleted.addListener(
    (details) => {
      const url = details.url;
      if (url.includes('.m3u8') || url.includes('.mpd') ||
          (details.type === 'xmlhttprequest' && (url.includes('manifest') || url.includes('playlist')))) {
        const type = url.includes('.mpd') ? 'dash' : 'hls';
        const tabId = details.tabId;
        if (!detectedStreams.has(tabId)) detectedStreams.set(tabId, []);
        const streams = detectedStreams.get(tabId)!;
        if (!streams.find(s => s.url === url)) {
          streams.push({ url, type, timestamp: Date.now() });
          sendToPanel({ action: 'streamDetected', url, type, tabId });
        }
      }
    },
    { urls: ['<all_urls>'] },
  );

  chrome.tabs.onRemoved.addListener((tabId) => {
    detectedStreams.delete(tabId);
  });
}
