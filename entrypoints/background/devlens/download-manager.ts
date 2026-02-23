import type { VideoData, DownloadRecord } from '../../../src/features/devlens/types';
import { recordDownload, extractVideoFilename } from '../../../src/features/devlens/services/auto-save';
import { extractHostname } from '../../../src/shared/utils/format';

let offscreenReady = false;

async function ensureOffscreen(): Promise<void> {
  if (offscreenReady) return;
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['BLOBS'],
      justification: 'Download and merge video segments',
    });
    offscreenReady = true;
  } catch (e: any) {
    if (e.message?.includes('already')) offscreenReady = true;
    else throw e;
  }
}

export async function downloadImage(
  url: string,
  filename: string | null,
  saveAs: boolean,
  sendToPanel: (msg: any) => void,
): Promise<void> {
  let pageUrl = '';
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.url) pageUrl = activeTab.url;
  } catch { /* ignore */ }

  try {
    const response = await fetch(url, { credentials: 'include' });
    const blob = await response.blob();
    const ct = blob.type || 'image/png';

    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const dataUrl = `data:${ct};base64,${btoa(binary)}`;

    let cleanName = filename || 'image';
    cleanName = cleanName.replace(/[<>:"/\\|?*]/g, '_');
    if (!cleanName.includes('.')) {
      const extMap: Record<string, string> = {
        'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
        'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/avif': '.avif',
      };
      cleanName += extMap[ct] || '.png';
    }

    chrome.downloads.download({ url: dataUrl, filename: cleanName, saveAs }, (downloadId) => {
      if (chrome.runtime.lastError) {
        chrome.downloads.download({ url: dataUrl, saveAs });
      } else if (downloadId) {
        recordDownload({
          downloadId,
          sourceUrl: url,
          pageUrl,
          hostname: extractHostname(pageUrl),
          filename: cleanName,
          contentType: ct,
          fileSize: buffer.byteLength,
          timestamp: Date.now(),
        });
      }
    });
  } catch (err: any) {
    chrome.downloads.download({ url, saveAs }, () => {
      if (chrome.runtime.lastError) {
        sendToPanel({ action: 'downloadComplete', path: '다운로드 실패: ' + (chrome.runtime.lastError.message || err.message) });
      }
    });
  }
}

export async function downloadVideo(
  srcUrl: string,
  filename: string | null,
  sendToPanel: (msg: any) => void,
): Promise<void> {
  sendToPanel({ action: 'videoProgress', stage: 'downloading', percent: 0, message: '다운로드 중...' });
  try {
    let cleanName = filename || 'video';
    if (!/\.(mp4|webm|mkv|mov|ts|m4v|m4a|mp3)$/i.test(cleanName)) {
      cleanName += '.mp4';
    }

    chrome.downloads.download({ url: srcUrl, filename: cleanName, saveAs: true }, (id) => {
      if (chrome.runtime.lastError) {
        sendToPanel({ action: 'videoProgress', stage: 'error', percent: 0, message: chrome.runtime.lastError.message });
      } else {
        sendToPanel({ action: 'videoProgress', stage: 'done', percent: 100, message: '다운로드 시작됨' });
      }
    });
  } catch (err: any) {
    sendToPanel({ action: 'videoProgress', stage: 'error', percent: 0, message: err.message });
  }
}

export async function startVideoDownload(
  videoData: VideoData,
  sendToPanel: (msg: any) => void,
  fetchIgVideoUrl: (shortcode: string) => Promise<string>,
): Promise<void> {
  sendToPanel({ action: 'videoProgress', stage: 'init', percent: 0, message: '다운로드 준비 중...' });

  try {
    // Instagram: use API
    if (videoData.igShortcode) {
      sendToPanel({ action: 'videoProgress', stage: 'downloading', percent: 0, message: 'Instagram API 요청 중...' });
      const videoUrl = await fetchIgVideoUrl(videoData.igShortcode);
      const filename = extractVideoFilename(videoData);
      chrome.downloads.download({ url: videoUrl, filename, saveAs: true }, (id) => {
        if (chrome.runtime.lastError) {
          sendToPanel({ action: 'videoProgress', stage: 'error', percent: 0, message: chrome.runtime.lastError.message });
        } else {
          sendToPanel({ action: 'videoProgress', stage: 'done', percent: 100, message: '다운로드 시작됨' });
        }
      });
      return;
    }

    await ensureOffscreen();

    if (videoData.streamUrl && videoData.streamType === 'hls') {
      const baseUrl = videoData.streamUrl.substring(0, videoData.streamUrl.lastIndexOf('/') + 1);
      chrome.runtime.sendMessage({
        action: 'downloadHLS',
        manifestUrl: videoData.streamUrl,
        baseUrl,
        filename: extractVideoFilename(videoData),
      });
    } else if (!videoData.isBlob && videoData.src) {
      const isYoutube = videoData.src.includes('googlevideo.com') || videoData.src.includes('videoplayback');

      if (!isYoutube) {
        await downloadVideo(videoData.src, extractVideoFilename(videoData), sendToPanel);
      } else {
        chrome.runtime.sendMessage({
          action: 'downloadDirect',
          url: videoData.src,
          filename: extractVideoFilename(videoData),
          expectedSize: (videoData as any).expectedSize || 0,
        });
      }
    } else {
      sendToPanel({ action: 'videoProgress', stage: 'error', percent: 0, message: '다운로드할 수 없는 소스입니다 (blob URL, 스트림 URL 미감지)' });
    }
  } catch (err: any) {
    sendToPanel({ action: 'videoProgress', stage: 'error', percent: 0, message: err.message });
  }
}

export function initDownloadListener(sendToPanel: (msg: any) => void): void {
  chrome.downloads.onChanged.addListener((delta) => {
    if (delta.state && delta.state.current === 'complete') {
      chrome.downloads.search({ id: delta.id }, async (results) => {
        if (results && results[0]) {
          const item = results[0];
          if (item.filename) {
            sendToPanel({ action: 'downloadComplete', path: item.filename });
          }
          if (item.fileSize > 0) {
            try {
              const stored = await chrome.storage.local.get('devlensDownloads');
              const downloads: DownloadRecord[] = stored.devlensDownloads || [];
              const entry = downloads.find(d => d.downloadId === delta.id);
              if (entry) {
                entry.fileSize = item.fileSize;
                await chrome.storage.local.set({ devlensDownloads: downloads });
              }
            } catch { /* silent */ }
          }
        }
      });
    }
  });
}
