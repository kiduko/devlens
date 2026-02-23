import { toast } from '../../../shared/components/Toast';
import { extractFilename, escShell } from '../../../shared/utils/format';
import type { ImageData, DevLensPanelMessage } from '../types';

interface ImageActionsProps {
  currentSrc: string;
  currentImageData: ImageData | null;
  sendMessage: (msg: DevLensPanelMessage) => void;
}

export function ImageActions({ currentSrc, currentImageData, sendMessage }: ImageActionsProps) {
  const isBase64 = currentSrc.startsWith('data:');

  const handleSave = () => {
    sendMessage({ action: 'downloadImage', url: currentSrc, filename: extractFilename(currentSrc) || 'image', saveAs: false });
  };

  const handleDownload = () => {
    sendMessage({ action: 'downloadImage', url: currentSrc, filename: extractFilename(currentSrc) || 'image', saveAs: true });
  };

  const handleCopy = async () => {
    try {
      const response = await fetch(currentSrc, { credentials: 'include' });
      const originalBlob = await response.blob();

      let pngBlob: Blob;
      if (originalBlob.type === 'image/png') {
        pngBlob = originalBlob;
      } else {
        const bitmap = await createImageBitmap(originalBlob);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        pngBlob = await new Promise<Blob>((r) => canvas.toBlob(b => r(b!), 'image/png'));
      }

      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      toast('이미지가 복사되었습니다');
    } catch {
      navigator.clipboard.writeText(currentSrc).then(() => toast('URL이 복사되었습니다'));
    }
  };

  const handleOpenTab = () => {
    if (isBase64) return;
    window.open(currentSrc, '_blank');
  };

  const handleCopyCurl = () => {
    if (isBase64) return;
    const parts = [`curl '${escShell(currentSrc)}'`];
    parts.push(`  -H 'accept: image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'`);
    if (currentImageData?.pageUrl) {
      parts.push(`  -H 'referer: ${escShell(currentImageData.pageUrl)}'`);
    }
    parts.push(`  -H 'user-agent: ${escShell(navigator.userAgent)}'`);
    navigator.clipboard.writeText(parts.join(' \\\n')).then(() => toast('cURL이 복사되었습니다'));
  };

  return (
    <div className="dl-actions">
      <button className="dl-action-btn dl-primary" onClick={handleSave}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        저장
      </button>
      <button className="dl-action-btn" onClick={handleDownload}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
        </svg>
        저장...
      </button>
      <button className="dl-action-btn" onClick={handleCopy}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
        복사
      </button>
      <button className={`dl-action-btn${isBase64 ? ' dl-disabled' : ''}`} onClick={handleOpenTab}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        열기
      </button>
      <button className={`dl-action-btn${isBase64 ? ' dl-disabled' : ''}`} onClick={handleCopyCurl}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
        </svg>
        cURL
      </button>
    </div>
  );
}
