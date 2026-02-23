import { useDevLensStore } from '../stores/devlens-store';
import { useSettingsStore } from '../stores/settings-store';
import type { DevLensPanelMessage } from '../types';

interface HistoryBarProps {
  sendMessage: (msg: DevLensPanelMessage) => void;
}

export function HistoryBar({ sendMessage }: HistoryBarProps) {
  const { imageHistory, currentSrc, clearHistory } = useDevLensStore();
  const { settings } = useSettingsStore();

  if (!settings.enableHistory || imageHistory.length === 0) return null;

  return (
    <footer className="dl-history">
      <div className="dl-history-header">
        <span>최근 이미지</span>
        <button className="dl-history-clear" onClick={clearHistory}>지우기</button>
      </div>
      <div className="dl-history-grid">
        {imageHistory.map((item) => (
          <div
            key={item.src}
            className={`dl-history-item${item.src === currentSrc ? ' dl-active' : ''}`}
            onClick={() => sendMessage({ action: 'refetchImage', src: item.src })}
          >
            <img src={item.src} alt="" />
          </div>
        ))}
      </div>
    </footer>
  );
}
