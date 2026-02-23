import type { DevLensSettings, DownloadRecord, VideoData } from '../types';
import { extractHostname } from '../../../shared/utils/format';

const MAX_DOWNLOAD_RECORDS = 500;

export async function recordDownload(entry: DownloadRecord): Promise<void> {
  try {
    const result = await chrome.storage.local.get('devlensDownloads');
    const downloads: DownloadRecord[] = result.devlensDownloads || [];
    downloads.unshift(entry);
    if (downloads.length > MAX_DOWNLOAD_RECORDS) downloads.length = MAX_DOWNLOAD_RECORDS;
    await chrome.storage.local.set({ devlensDownloads: downloads });
  } catch { /* silent */ }
}

export function buildSubfolderPath(folderMode: string, rootFolder: string, pageUrl: string): string {
  const root = (rootFolder || 'DevLens').replace(/[<>:"|?*]/g, '_');
  if (folderMode === 'none' || !folderMode) return root;
  const today = new Date().toISOString().slice(0, 10);
  const site = extractHostname(pageUrl || '');
  const parts = [root];
  if (folderMode === 'date') parts.push(today);
  else if (folderMode === 'site') parts.push(site);
  else if (folderMode === 'date-site') { parts.push(today); parts.push(site); }
  else if (folderMode === 'site-date') { parts.push(site); parts.push(today); }
  return parts.join('/');
}

export async function convertImageFormat(url: string, format: 'png' | 'jpg'): Promise<string | null> {
  const response = await fetch(url, { credentials: 'include' });
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  const quality = format === 'jpg' ? 0.92 : undefined;
  const convertedBlob = await canvas.convertToBlob({ type: mimeType, quality });

  const buffer = await convertedBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

export async function tryAutoSave(
  url: string,
  contentType: string,
  pageUrl: string | null,
  sendToPanel: (msg: any) => void,
): Promise<void> {
  try {
    const result = await chrome.storage.local.get('devlensSettings');
    const settings: DevLensSettings | undefined = result.devlensSettings;
    if (!settings?.autoSave) return;

    const prefix = settings.filePrefix || 'devlens_';
    const format = settings.saveFormat || 'original';
    const folderMode = settings.folderMode || 'none';
    const rootFolder = settings.rootFolder || 'DevLens';

    let baseName = 'image';
    let originalExt = '';
    try {
      const pathname = new URL(url).pathname;
      const filename = decodeURIComponent(pathname.split('/').pop() || '');
      if (filename && filename.includes('.')) {
        const dotIdx = filename.lastIndexOf('.');
        baseName = filename.substring(0, dotIdx);
        originalExt = filename.substring(dotIdx);
      } else if (filename) {
        baseName = filename;
      }
    } catch { /* use defaults */ }

    const skipConversion = contentType && (contentType.includes('gif') || contentType.includes('svg'));
    let ext = originalExt;
    if (!skipConversion && format === 'png') {
      ext = '.png';
    } else if (!skipConversion && format === 'jpg') {
      ext = '.jpg';
    } else if (!ext) {
      const extMap: Record<string, string> = {
        'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
        'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/avif': '.avif',
        'image/bmp': '.bmp', 'image/tiff': '.tiff',
      };
      for (const [mime, e] of Object.entries(extMap)) {
        if (contentType && contentType.includes(mime)) { ext = e; break; }
      }
      if (!ext) ext = '.png';
    }

    const subfolderPath = buildSubfolderPath(folderMode, rootFolder, pageUrl || '');
    const downloadFilename = `${subfolderPath}/${prefix}${baseName}${ext}`;

    const isAnimatable = contentType && (contentType.includes('gif') || contentType.includes('svg'));
    let downloadUrl = url;
    if (format !== 'original' && !isAnimatable && contentType && !contentType.includes(format === 'png' ? 'png' : 'jpeg')) {
      try {
        const convertedUrl = await convertImageFormat(url, format as 'png' | 'jpg');
        if (convertedUrl) downloadUrl = convertedUrl;
      } catch { /* fallback to original URL */ }
    }

    chrome.downloads.download({
      url: downloadUrl,
      filename: downloadFilename,
      saveAs: false,
    }, (downloadId) => {
      if (!chrome.runtime.lastError && downloadId) {
        recordDownload({
          downloadId,
          sourceUrl: url,
          pageUrl: pageUrl || '',
          hostname: extractHostname(pageUrl || ''),
          filename: downloadFilename,
          contentType: contentType || '',
          fileSize: 0,
          timestamp: Date.now(),
        });
      }
    });
  } catch { /* auto-save failure should be silent */ }
}

export function extractVideoFilename(data: VideoData): string {
  if (data.igUsername) {
    const ts = new Date().toISOString().slice(0, 10);
    return `${data.igUsername}_${ts}.mp4`;
  }
  if (data.streamUrl) {
    try {
      const name = new URL(data.streamUrl).pathname.split('/').pop();
      if (name) return name.replace(/\.m3u8.*$/, '').replace(/\.mpd.*$/, '') || 'video';
    } catch { /* ignore */ }
  }
  if (data.src && !data.isBlob) {
    try {
      const u = new URL(data.src);
      let name = u.pathname.split('/').pop();
      if (name === 'videoplayback' || name === 'player') {
        const itag = u.searchParams.get('itag');
        const mime = u.searchParams.get('mime') || '';
        const ext = mime.includes('webm') ? 'webm' : 'mp4';
        name = itag ? `video_itag${itag}.${ext}` : `video.${ext}`;
      }
      if (name) return name;
    } catch { /* ignore */ }
  }
  return 'video';
}

export async function tryAutoSaveVideo(
  videoData: VideoData,
  pageUrl: string | null,
  sendToPanel: (msg: any) => void,
  fetchIgVideoUrl: (shortcode: string) => Promise<string>,
): Promise<void> {
  try {
    const result = await chrome.storage.local.get('devlensSettings');
    const settings: DevLensSettings | undefined = result.devlensSettings;
    if (!settings?.autoSave) return;

    const prefix = settings.filePrefix || 'devlens_';
    const folderMode = settings.folderMode || 'none';
    const rootFolder = settings.rootFolder || 'DevLens';
    const subfolderPath = buildSubfolderPath(folderMode, rootFolder, pageUrl || '');

    let baseName = extractVideoFilename(videoData);
    if (!/\.(mp4|webm|mkv|mov|ts|m4v)$/i.test(baseName)) baseName += '.mp4';
    const downloadFilename = `${subfolderPath}/${prefix}${baseName}`;

    // Instagram with shortcode
    if (videoData.igShortcode) {
      try {
        const videoUrl = await fetchIgVideoUrl(videoData.igShortcode);
        chrome.downloads.download({ url: videoUrl, filename: downloadFilename, saveAs: false }, (downloadId) => {
          if (!chrome.runtime.lastError && downloadId) {
            recordDownload({
              downloadId, sourceUrl: videoUrl, pageUrl: pageUrl || '',
              hostname: extractHostname(pageUrl || ''), filename: downloadFilename,
              contentType: 'video/mp4', fileSize: 0, timestamp: Date.now(),
            });
          }
        });
        sendToPanel({ action: 'videoProgress', stage: 'done', percent: 100, message: '자동 저장됨' });
      } catch { /* silent */ }
      return;
    }

    // Direct (non-blob) video URL
    if (!videoData.isBlob && videoData.src) {
      chrome.downloads.download({ url: videoData.src, filename: downloadFilename, saveAs: false }, (downloadId) => {
        if (!chrome.runtime.lastError && downloadId) {
          recordDownload({
            downloadId, sourceUrl: videoData.src, pageUrl: pageUrl || '',
            hostname: extractHostname(pageUrl || ''), filename: downloadFilename,
            contentType: 'video/mp4', fileSize: videoData.fileSize || 0, timestamp: Date.now(),
          });
          sendToPanel({ action: 'videoProgress', stage: 'done', percent: 100, message: '자동 저장됨' });
        }
      });
    }
  } catch { /* auto-save failure should be silent */ }
}
