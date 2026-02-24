import { useDevLensStore } from '../stores/devlens-store';
import { analyzeAccess } from '../services/access-analyzer';
import { formatFileSize, formatContentType } from '../../../shared/utils/format';
import { ImagePreview } from './ImagePreview';
import { ImageActions } from './ImageActions';
import { InfoSection } from './InfoSection';
import { AccessAnalysis } from './AccessAnalysis';
import { CompareBar } from './CompareBar';
import { UrlParamEditor } from './UrlParamEditor';
import type { DevLensPanelMessage } from '../types';

interface ImageViewProps {
  sendMessage: (msg: DevLensPanelMessage) => void;
}

export function ImageView({ sendMessage }: ImageViewProps) {
  const { currentImageData, currentSrc, previousImageData, pendingCompare, detectedUrlParams, originalSrc } = useDevLensStore();

  if (!currentImageData || !currentSrc) return null;

  const data = currentImageData;
  const isBase64 = currentSrc.startsWith('data:');

  // Basic info rows
  const basicRows: Array<{ label: string; value: string; renderValue?: React.ReactNode }> = [];

  if (isBase64) {
    const mimeMatch = currentSrc.match(/^data:([^;,]+)/);
    const mime = mimeMatch ? mimeMatch[1] : 'unknown';
    basicRows.push({ label: '소스', value: 'Base64', renderValue: <span className="dl-badge dl-base64">Base64</span> });
    basicRows.push({ label: '포맷', value: formatContentType(mime) });
    basicRows.push({ label: '데이터 크기', value: formatFileSize(data.fileSize) });
  } else {
    basicRows.push({ label: '포맷', value: formatContentType(data.contentType) });
    basicRows.push({ label: '파일 크기', value: formatFileSize(data.fileSize) });
  }

  if (data.pageInfo) {
    if (data.pageInfo.naturalWidth && data.pageInfo.naturalHeight)
      basicRows.push({ label: '원본 크기', value: `${data.pageInfo.naturalWidth} x ${data.pageInfo.naturalHeight}` });
    if (data.pageInfo.renderWidth && data.pageInfo.renderHeight)
      basicRows.push({ label: '렌더 크기', value: `${data.pageInfo.renderWidth} x ${data.pageInfo.renderHeight}` });
    if (data.pageInfo.alt)
      basicRows.push({ label: 'Alt 텍스트', value: data.pageInfo.alt });
  }

  if (!isBase64) {
    basicRows.push({ label: 'URL', value: currentSrc });
  }

  // Access analysis
  const accessItems = !isBase64
    ? analyzeAccess(currentSrc, data.headers || {}, data.credentialMode, data.status, data.cookieInfo, data.urlAuthParams)
    : [];

  // HTTP headers
  const headerRows: Array<{ label: string; value: string }> = [];
  if (data.headers && Object.keys(data.headers).length > 0) {
    if (data.status) headerRows.push({ label: 'Status', value: `${data.status} ${data.statusText || ''}` });
    for (const [k, v] of Object.entries(data.headers)) {
      headerRows.push({ label: k, value: v });
    }
  }

  // EXIF groups
  const exifGroups = data.exif?.formatted && Object.keys(data.exif.formatted).length > 0 ? [
    { title: '카메라', keys: ['카메라 제조사','카메라 모델','렌즈 제조사','렌즈 모델','소프트웨어'] },
    { title: '촬영 설정', keys: ['셔터 속도','조리개','ISO','초점 거리','35mm 환산','노출 보정','노출 모드','측광 모드','플래시'] },
    { title: '메타데이터', keys: ['촬영 일시','색 공간','원본 크기','작가','저작권'] },
    { title: '위치', keys: ['GPS 위치','고도'] },
  ] : null;

  return (
    <>
      <ImagePreview src={currentSrc} thumbDataUrl={data.thumbDataUrl} />
      <ImageActions currentSrc={currentSrc} currentImageData={data} sendMessage={sendMessage} />

      {data.error ? (
        <div className="dl-no-exif">{data.error}</div>
      ) : (
        <>
          {pendingCompare && previousImageData ? (
            <CompareBar
              previousData={previousImageData}
              currentData={data}
              sendMessage={sendMessage}
            />
          ) : null}

          <InfoSection title="기본 정보" rows={basicRows} />

          <AccessAnalysis items={accessItems} />

          {headerRows.length > 0 && (
            <InfoSection title="HTTP 응답 헤더" rows={headerRows} />
          )}

          {exifGroups ? (
            exifGroups.map((group) => {
              const rows: Array<{ label: string; value: string; renderValue?: React.ReactNode }> = [];
              for (const key of group.keys) {
                if (data.exif!.formatted[key] == null) continue;
                if (key === 'GPS 위치' && data.exif!.gps) {
                  const gpsText = String(data.exif!.formatted[key]);
                  rows.push({
                    label: key,
                    value: gpsText,
                    renderValue: (
                      <a
                        href={`https://www.google.com/maps?q=${data.exif!.gps.lat},${data.exif!.gps.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {gpsText}
                      </a>
                    ),
                  });
                } else {
                  rows.push({ label: key, value: String(data.exif!.formatted[key]) });
                }
              }
              if (rows.length === 0) return null;
              return <InfoSection key={group.title} title={group.title} rows={rows} />;
            })
          ) : (
            <div className="dl-no-exif">EXIF 데이터가 없습니다</div>
          )}

          {!isBase64 && detectedUrlParams.length > 0 && (
            <UrlParamEditor sendMessage={sendMessage} />
          )}
        </>
      )}
    </>
  );
}
