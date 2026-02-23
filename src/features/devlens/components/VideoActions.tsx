import { toast } from '../../../shared/components/Toast';
import { escShell } from '../../../shared/utils/format';
import type { VideoData } from '../types';

interface VideoActionsProps {
  data: VideoData;
}

export function VideoActions({ data }: VideoActionsProps) {
  const handleDownload = () => {
    const isInstagram = data.pageUrl?.includes('instagram.com');

    // Instagram MSE buffer capture
    if (isInstagram && data.isBlob && data.captureInfo && data.captureInfo.totalSize > 0) {
      const datePart = new Date().toISOString().slice(0, 10);
      const filename = data.igUsername
        ? `${data.igUsername}_${datePart}`
        : `instagram_${datePart}`;
      chrome.runtime.sendMessage({ action: 'downloadCapture', filename, blobUrl: data.src });
      toast('버퍼 다운로드 시작...');
      return;
    }

    // Instagram API fallback
    if (data.igShortcode) {
      chrome.runtime.sendMessage({ action: 'startVideoDownload', videoData: data });
      toast('다운로드 시작...');
      return;
    }

    // Direct media URLs (YouTube etc)
    if (data.directMedia && data.directMedia.length > 0) {
      const videoTrack = data.directMedia.find(m => m.mime?.startsWith('video'));
      const target = videoTrack || data.directMedia[0];
      chrome.runtime.sendMessage({
        action: 'startVideoDownload',
        videoData: { ...data, src: target.url, isBlob: false, expectedSize: target.size || 0 },
      });
      toast('다운로드 시작...');
      return;
    }

    // Blob with captured buffer
    if (data.isBlob && !data.streamUrl && data.captureInfo?.totalSize > 0) {
      chrome.runtime.sendMessage({ action: 'downloadCapture', filename: 'video', blobUrl: data.src });
      toast('버퍼 다운로드 시작...');
      return;
    }

    chrome.runtime.sendMessage({ action: 'startVideoDownload', videoData: data });
  };

  const handleCopyCurl = () => {
    const url = data.streamUrl || data.src;
    if (!url || url.startsWith('blob:')) {
      toast('cURL 생성 불가 (Blob URL)');
      return;
    }
    const parts = [`curl '${escShell(url)}'`];
    if (data.pageUrl) parts.push(`  -H 'referer: ${escShell(data.pageUrl)}'`);
    parts.push(`  -H 'user-agent: ${escShell(navigator.userAgent)}'`);
    parts.push(`  -o 'video.mp4'`);
    navigator.clipboard.writeText(parts.join(' \\\n')).then(() => toast('cURL이 복사되었습니다'));
  };

  const handleCopyUrl = () => {
    const url = data.streamUrl || data.src;
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => toast('URL이 복사되었습니다'));
  };

  return (
    <div className="dl-actions">
      <button className="dl-action-btn dl-primary" onClick={handleDownload}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        다운로드
      </button>
      <button className="dl-action-btn" onClick={handleCopyCurl}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
        </svg>
        cURL
      </button>
      <button className="dl-action-btn" onClick={handleCopyUrl}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
        복사
      </button>
    </div>
  );
}
