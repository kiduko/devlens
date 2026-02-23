import { useState } from 'react';

interface HeaderProps {
  isPopup: boolean;
  onSettingsOpen: () => void;
}

export function Header({ isPopup, onSettingsOpen }: HeaderProps) {
  const [pinned, setPinned] = useState(false);

  const handlePin = () => {
    const next = !pinned;
    setPinned(next);
    chrome.runtime.sendMessage({ action: 'setAlwaysOnTop', enabled: next });
  };

  const handleGallery = () => {
    chrome.tabs.create({ url: 'gallery.html' });
  };

  const handlePopout = async () => {
    if (isPopup) {
      const params = new URLSearchParams(location.search);
      const fromTab = Number(params.get('fromTab')) || 0;
      const fromWindow = Number(params.get('fromWindow')) || 0;
      try {
        if (fromTab) {
          const tab = await chrome.tabs.get(fromTab).catch(() => null);
          if (tab) {
            await chrome.windows.update(tab.windowId, { focused: true });
            await chrome.sidePanel.open({ tabId: tab.id! });
            window.close();
            return;
          }
        }
        if (fromWindow) {
          try {
            await chrome.windows.update(fromWindow, { focused: true });
            const tabs = await chrome.tabs.query({ active: true, windowId: fromWindow });
            if (tabs[0]) {
              await chrome.sidePanel.open({ tabId: tabs[0].id! });
              window.close();
              return;
            }
          } catch { /* ignore */ }
        }
        const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
        if (windows[0]) {
          await chrome.windows.update(windows[0].id!, { focused: true });
          const tabs = await chrome.tabs.query({ active: true, windowId: windows[0].id });
          if (tabs[0]) await chrome.sidePanel.open({ tabId: tabs[0].id! });
        }
      } catch { /* ignore */ }
      window.close();
    } else {
      chrome.runtime.sendMessage({ action: 'popOut' });
      window.close();
    }
  };

  return (
    <header className="dl-header">
      <div className="dl-header-left">
        <svg className="dl-header-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span className="dl-header-title">DevLens</span>
      </div>
      <div className="dl-header-right">
        <div className="dl-header-status">
          <span className="dl-status-dot" /> <kbd>Cmd</kbd>+클릭으로 선택
        </div>
        {isPopup && (
          <button className={`dl-settings-btn${pinned ? ' dl-pinned' : ''}`} title="항상 위에" onClick={handlePin}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 4v6l-2 4h10l-2-4V4"/><line x1="12" y1="16" x2="12" y2="21"/><line x1="8" y1="4" x2="16" y2="4"/>
            </svg>
          </button>
        )}
        <button className="dl-settings-btn" title="갤러리" onClick={handleGallery}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
          </svg>
        </button>
        <button className="dl-settings-btn" title="별도 창으로 열기" onClick={handlePopout}>
          {isPopup ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="18" rx="1"/><line x1="14" y1="12" x2="21" y2="12"/><polyline points="17 8 14 12 17 16"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          )}
        </button>
        <button className="dl-settings-btn" title="설정" onClick={onSettingsOpen}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
