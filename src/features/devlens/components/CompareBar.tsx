import { useDevLensStore } from '../stores/devlens-store';
import { formatFileSize } from '../../../shared/utils/format';
import { toast } from '../../../shared/components/Toast';
import type { ImageData, DevLensPanelMessage } from '../types';

interface CompareBarProps {
  previousData: ImageData;
  currentData: ImageData;
  sendMessage: (msg: DevLensPanelMessage) => void;
}

export function CompareBar({ previousData, currentData, sendMessage }: CompareBarProps) {
  const { setPreviousImageData, setPendingCompare } = useDevLensStore();

  const prevSize = previousData.fileSize || 0;
  const newSize = currentData.fileSize || 0;
  const prevW = previousData.pageInfo?.naturalWidth || 0;
  const prevH = previousData.pageInfo?.naturalHeight || 0;
  const newW = currentData.pageInfo?.naturalWidth || 0;
  const newH = currentData.pageInfo?.naturalHeight || 0;

  const sizeChange = prevSize > 0 ? (((newSize - prevSize) / prevSize) * 100).toFixed(1) : '?';
  const bigger = newSize > prevSize;
  const dimChanged = newW !== prevW || newH !== prevH;

  const handleKeep = () => {
    setPreviousImageData(null);
    setPendingCompare(false);
    toast('새 이미지를 유지합니다');
  };

  const handleRevert = () => {
    const prevSrc = previousData.src;
    setPreviousImageData(null);
    setPendingCompare(false);
    if (prevSrc) {
      sendMessage({ action: 'refetchImage', src: prevSrc });
      toast('이전 이미지로 되돌리는 중...');
    }
  };

  return (
    <div className="dl-compare-banner">
      <div className="dl-compare-title">변경 결과 비교</div>
      <div className="dl-compare-grid">
        <div className="dl-compare-col">
          <span className="dl-compare-label">이전</span>
          <span className="dl-compare-val">{formatFileSize(prevSize)}</span>
          {prevW > 0 && <span className="dl-compare-dim">{prevW}x{prevH}</span>}
        </div>
        <div className="dl-compare-arrow">{bigger ? '▲' : '▼'}</div>
        <div className="dl-compare-col">
          <span className="dl-compare-label">현재</span>
          <span className="dl-compare-val">{formatFileSize(newSize)}</span>
          {newW > 0 && <span className="dl-compare-dim">{newW}x{newH}</span>}
        </div>
      </div>
      <div className={`dl-compare-diff ${bigger ? 'dl-positive' : 'dl-negative'}`}>
        용량 {bigger ? '+' : ''}{sizeChange}%{dimChanged ? ` · 해상도 ${newW}x${newH}` : ''}
      </div>
      <div className="dl-compare-actions">
        <button className="dl-action-btn dl-primary" onClick={handleKeep}>유지</button>
        <button className="dl-action-btn" onClick={handleRevert}>되돌리기</button>
      </div>
    </div>
  );
}
