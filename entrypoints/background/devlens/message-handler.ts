import { processImage } from './image-processor';
import { processVideo, fetchIgVideoUrl } from './video-processor';
import { downloadImage, startVideoDownload, downloadVideo, initDownloadListener } from './download-manager';
import { initStreamDetector } from './stream-detector';

const panelPorts = new Set<chrome.runtime.Port>();
let popupWindowId: number | null = null;
let lastPanelState: any = null;
let alwaysOnTop = false;
let autoSaveEnabled = false;

function sendToPanel(msg: any): void {
  if (msg.action === 'imageData' || msg.action === 'videoData' || msg.action === 'imageError') {
    lastPanelState = msg;
  }
  for (const p of panelPorts) {
    try { p.postMessage(msg); } catch { panelPorts.delete(p); }
  }
  if (alwaysOnTop && popupWindowId && (msg.action === 'imageData' || msg.action === 'videoData')) {
    chrome.windows.update(popupWindowId, { focused: true }).catch(() => {});
  }
}

function shouldInspectorBeActive(): boolean {
  return panelPorts.size > 0 || autoSaveEnabled;
}

function activateAllTabs(): void {
  chrome.tabs.query({}, (tabs) => {
    for (const t of tabs) {
      if (t.id) chrome.tabs.sendMessage(t.id, { action: 'activateInspector' }).catch(() => {});
    }
  });
}

function deactivateAllTabs(): void {
  chrome.tabs.query({}, (tabs) => {
    for (const t of tabs) {
      if (t.id) chrome.tabs.sendMessage(t.id, { action: 'deactivateInspector' }).catch(() => {});
    }
  });
}

export function initDevLensBackground(): void {
  // Load autoSave state on startup
  chrome.storage.local.get('devlensSettings', (result) => {
    autoSaveEnabled = !!(result.devlensSettings && result.devlensSettings.autoSave);
    if (autoSaveEnabled) activateAllTabs();
  });

  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.devlensSettings) return;
    const newSettings = changes.devlensSettings.newValue;
    const wasEnabled = autoSaveEnabled;
    autoSaveEnabled = !!(newSettings && newSettings.autoSave);

    if (autoSaveEnabled && !wasEnabled) {
      activateAllTabs();
    } else if (!autoSaveEnabled && panelPorts.size === 0) {
      deactivateAllTabs();
    }
  });

  // Tab navigation → re-activate inspector
  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status === 'complete' && shouldInspectorBeActive()) {
      chrome.tabs.sendMessage(tabId, { action: 'activateInspector' }).catch(() => {});
    }
  });

  // Context menu
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'devlens-inspect',
      title: 'DevLens: 이미지 정보 보기',
      contexts: ['image'],
    });
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'devlens-inspect' && tab?.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
      setTimeout(() => processImage(info.srcUrl!, null, sendToPanel), 500);
    }
  });

  // Popup window tracking
  chrome.windows.onRemoved.addListener((windowId) => {
    if (windowId === popupWindowId) {
      popupWindowId = null;
      alwaysOnTop = false;
    }
  });

  // Initialize sub-systems
  initStreamDetector(sendToPanel);
  initDownloadListener(sendToPanel);
}

export function handlePortConnect(port: chrome.runtime.Port): void {
  panelPorts.add(port);
  activateAllTabs();

  if (lastPanelState) {
    try { port.postMessage(lastPanelState); } catch { /* ignore */ }
  }

  port.onMessage.addListener((msg) => {
    if (msg.action === 'downloadImage') {
      downloadImage(msg.url, msg.filename, msg.saveAs !== false, sendToPanel);
    }
    if (msg.action === 'refetchImage') {
      processImage(msg.src, null, sendToPanel);
    }
  });

  port.onDisconnect.addListener(() => {
    panelPorts.delete(port);
    if (panelPorts.size === 0 && !autoSaveEnabled) {
      deactivateAllTabs();
    }
  });
}

export function handleMessage(msg: any): void {
  if (msg.action === 'setAlwaysOnTop') {
    alwaysOnTop = msg.enabled;
    return;
  }
  if (msg.action === 'popOut') {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
      const tabId = tab ? tab.id : '';
      const windowId = tab ? tab.windowId : '';
      chrome.windows.create({
        url: chrome.runtime.getURL(`sidepanel.html?popup=1&fromTab=${tabId}&fromWindow=${windowId}`),
        type: 'popup',
        width: 400,
        height: 720,
        focused: true,
      }, (win) => {
        if (win) popupWindowId = win.id!;
      });
    });
    return;
  }
  if (msg.action === 'imageSelected') {
    processImage(msg.src, msg.pageInfo || null, sendToPanel);
  }
  if (msg.action === 'videoSelected') {
    processVideo(msg.videoInfo, sendToPanel);
  }
  if (msg.action === 'contentReady' && shouldInspectorBeActive()) {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { action: 'activateInspector' }).catch(() => {});
    });
  }
  if (msg.action === 'videoProgress') {
    sendToPanel({ action: 'videoProgress', stage: msg.stage, percent: msg.percent, message: msg.message });
  }
  if (msg.action === 'saveVideoBlob') {
    chrome.downloads.download({ url: msg.url, filename: msg.filename, saveAs: true });
  }
  if (msg.action === 'heartbeat') {
    // Keep-alive from offscreen doc — no-op
  }
  if (msg.action === 'startVideoDownload') {
    startVideoDownload(msg.videoData, sendToPanel, fetchIgVideoUrl);
  }
  if (msg.action === 'downloadCapture') {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { action: 'downloadCapture', filename: msg.filename, blobUrl: msg.blobUrl });
    });
  }
  if (msg.action === 'captureDownloadDone') {
    sendToPanel({ action: 'videoProgress', stage: 'done', percent: 100, message: '버퍼 다운로드 완료' });
  }
  if (msg.action === 'captureDownloadError') {
    sendToPanel({ action: 'videoProgress', stage: 'error', percent: 0, message: msg.error });
  }
}
