import { useDevLensStore } from '../stores/devlens-store';
import { formatFileSize } from '../../../shared/utils/format';
import { toast } from '../../../shared/components/Toast';
import { VideoPreview } from './VideoPreview';
import { VideoActions } from './VideoActions';
import { VideoProgress } from './VideoProgress';
import { InfoSection } from './InfoSection';

export function VideoView() {
  const { currentVideoData, videoProgress } = useDevLensStore();

  if (!currentVideoData) return null;

  const data = currentVideoData;

  // Basic info
  const basicRows: Array<{ label: string; value: string }> = [];
  if (data.durationFormatted) basicRows.push({ label: '재생 시간', value: data.durationFormatted });
  if (data.videoWidth && data.videoHeight) basicRows.push({ label: '원본 크기', value: `${data.videoWidth} x ${data.videoHeight}` });
  if (data.renderWidth && data.renderHeight) basicRows.push({ label: '렌더 크기', value: `${data.renderWidth} x ${data.renderHeight}` });
  if (data.fileSize) basicRows.push({ label: '파일 크기', value: formatFileSize(data.fileSize) });
  if (data.streamType) basicRows.push({ label: '스트림 타입', value: data.streamType.toUpperCase() });
  if (data.segmentCount) basicRows.push({ label: '세그먼트 수', value: `${data.segmentCount}개` });
  basicRows.push({ label: '소스', value: data.isBlob ? (data.isMsBlob ? 'Blob (MediaSource)' : 'Blob (스트리밍)') : data.src });
  if (data.streamUrl) basicRows.push({ label: '스트림 URL', value: data.streamUrl });

  // HTTP headers
  const headerRows: Array<{ label: string; value: string }> = [];
  if (data.headers && Object.keys(data.headers).length > 0) {
    for (const [k, v] of Object.entries(data.headers)) {
      headerRows.push({ label: k, value: v });
    }
  }

  // Download info
  const dlRows: Array<{ label: string; value: string }> = [];
  if (data.directMedia && data.directMedia.length > 0) {
    dlRows.push({ label: '다운로드 방식', value: '직접 미디어 URL' });
    dlRows.push({ label: '소스 수', value: `${data.directMedia.length}개` });
  } else if (data.streamUrl) {
    dlRows.push({ label: '다운로드 방식', value: data.streamType === 'hls' ? 'HLS 세그먼트 병합' : 'DASH 세그먼트 병합' });
  } else if (!data.isBlob) {
    dlRows.push({ label: '다운로드 방식', value: '직접 다운로드' });
  } else if (data.captureInfo && data.captureInfo.totalSize > 0) {
    dlRows.push({ label: '다운로드 방식', value: 'MSE 버퍼 캡처' });
    dlRows.push({ label: '캡처 크기', value: formatFileSize(data.captureInfo.totalSize) });
    dlRows.push({ label: '트랙', value: data.captureInfo.mimeTypes.join(', ') });
  } else {
    dlRows.push({ label: '다운로드 방식', value: '불가 (스트림 URL 미감지)' });
  }

  return (
    <>
      <VideoPreview data={data} />
      <VideoActions data={data} />

      {videoProgress && videoProgress.stage !== 'done' && (
        <VideoProgress progress={videoProgress} />
      )}

      <InfoSection title="기본 정보" rows={basicRows} />

      {headerRows.length > 0 && (
        <InfoSection title="HTTP 응답 헤더" rows={headerRows} />
      )}

      <InfoSection title="다운로드" rows={dlRows}>
        {data.directMedia && data.directMedia.length > 0 && (
          <div style={{ padding: '4px 10px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {data.directMedia.map((media, i) => {
              const isVideo = media.mime?.startsWith('video');
              const label = isVideo ? '영상' : '오디오';
              const mimeShort = media.mime ? media.mime.split('/').pop()?.split(';')[0] : '?';
              const sizeStr = media.size ? ` · ${formatFileSize(media.size)}` : '';
              const itagStr = media.itag ? ` (itag ${media.itag})` : '';

              return (
                <button
                  key={i}
                  className={`dl-action-btn${isVideo ? ' dl-primary' : ''}`}
                  style={{ width: '100%', textAlign: 'left', padding: '6px 8px', fontSize: '11px' }}
                  onClick={() => {
                    chrome.runtime.sendMessage({
                      action: 'startVideoDownload',
                      videoData: { src: media.url, isBlob: false, expectedSize: media.size || 0 },
                    });
                    toast('다운로드 시작...');
                  }}
                >
                  {label}: {mimeShort}{sizeStr}{itagStr}
                </button>
              );
            })}
          </div>
        )}

        {data.isBlob && !data.streamUrl && data.captureInfo && data.captureInfo.totalSize > 0 && (
          <div style={{ padding: '4px 10px 8px' }}>
            <button
              className="dl-action-btn dl-primary"
              style={{ width: '100%' }}
              onClick={() => {
                let fname = 'video';
                if (data.igUsername) {
                  fname = `${data.igUsername}_${new Date().toISOString().slice(0, 10)}`;
                }
                chrome.runtime.sendMessage({ action: 'downloadCapture', filename: fname, blobUrl: data.src });
                toast('버퍼 다운로드 시작...');
              }}
            >
              버퍼 다운로드 ({formatFileSize(data.captureInfo.totalSize)})
            </button>
          </div>
        )}
      </InfoSection>
    </>
  );
}
