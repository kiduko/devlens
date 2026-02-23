import { useState, useCallback } from 'react';
import { useDevLensStore } from '../stores/devlens-store';
import { buildModifiedUrl, buildBestQualityUrl, detectCdnName } from '../services/url-param-builder';
import { toast } from '../../../shared/components/Toast';
import { UrlParamRow } from './UrlParamRow';
import type { DevLensPanelMessage } from '../types';

interface UrlParamEditorProps {
  sendMessage: (msg: DevLensPanelMessage) => void;
}

export function UrlParamEditor({ sendMessage }: UrlParamEditorProps) {
  const { detectedUrlParams, originalSrc, currentSrc, currentImageData, setDetectedUrlParams, setPreviousImageData, setPendingCompare } = useDevLensStore();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewInfo, setPreviewInfo] = useState<string>('');

  const cdnName = detectCdnName(detectedUrlParams);

  const handleParamChange = useCallback((index: number, value: string | number) => {
    const updated = detectedUrlParams.map((p, i) => i === index ? { ...p, value } : p);
    setDetectedUrlParams(updated);

    if (originalSrc) {
      const newUrl = buildModifiedUrl(originalSrc, updated);
      setPreviewUrl(newUrl);
      setPreviewInfo('미리보기 로딩 중...');
    }
  }, [detectedUrlParams, originalSrc, setDetectedUrlParams]);

  const handleBestQuality = () => {
    if (!originalSrc) return;
    const bestUrl = buildBestQualityUrl(originalSrc, detectedUrlParams);
    if (bestUrl === originalSrc) {
      toast('이미 최고 화질 상태입니다');
      return;
    }
    setPreviousImageData(currentImageData ? { ...currentImageData, src: currentSrc! } : null);
    setPendingCompare(true);
    sendMessage({ action: 'refetchImage', src: bestUrl });
    toast('최고 화질 URL로 분석 중...');
  };

  const handleApply = () => {
    if (!originalSrc) return;
    const newUrl = buildModifiedUrl(originalSrc, detectedUrlParams);
    if (newUrl === originalSrc) {
      toast('변경된 값이 없습니다');
      return;
    }
    setPreviousImageData(currentImageData ? { ...currentImageData, src: currentSrc! } : null);
    setPendingCompare(true);
    sendMessage({ action: 'refetchImage', src: newUrl });
    toast('수정된 URL로 다시 분석 중...');
  };

  const handleRevert = () => {
    if (!originalSrc || currentSrc === originalSrc) {
      toast('이미 원본 상태입니다');
      return;
    }
    setPreviousImageData(null);
    setPendingCompare(false);
    const reverted = detectedUrlParams.map(p => ({ ...p, value: p.originalValue }));
    setDetectedUrlParams(reverted);
    sendMessage({ action: 'refetchImage', src: originalSrc });
    toast('원본 URL로 다시 분석 중...');
  };

  if (detectedUrlParams.length === 0) return null;

  return (
    <div className="dl-info-section dl-url-params-section">
      <div className="dl-info-section-header dl-url-params-header">
        URL 파라미터 <span className="dl-param-count">{detectedUrlParams.length}개 감지</span>
      </div>
      <div className="dl-info-section-body dl-url-params-body">
        {cdnName && <div className="dl-cdn-badge">{cdnName}</div>}

        {detectedUrlParams.map((param, i) => (
          <UrlParamRow
            key={`${param.source}-${param.type}-${i}`}
            param={param}
            onChange={(value) => handleParamChange(i, value)}
          />
        ))}

        {previewUrl && (
          <div className="dl-param-preview">
            <img
              src={previewUrl}
              alt="Preview"
              onLoad={(e) => {
                const img = e.target as HTMLImageElement;
                setPreviewInfo(`${img.naturalWidth} x ${img.naturalHeight}`);
              }}
              onError={() => setPreviewInfo('로드 실패 — 해당 값은 지원되지 않을 수 있습니다')}
            />
            <span className="dl-param-preview-info">{previewInfo}</span>
          </div>
        )}

        <div className="dl-param-actions">
          <button className="dl-action-btn dl-best-quality-btn" onClick={handleBestQuality}>최고 화질</button>
          <button className="dl-action-btn dl-primary dl-param-apply" onClick={handleApply}>적용</button>
          <button className="dl-action-btn dl-param-revert" onClick={handleRevert}>원본</button>
        </div>
      </div>
    </div>
  );
}
