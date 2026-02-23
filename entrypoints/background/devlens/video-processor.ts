import type { VideoData } from '../../../src/features/devlens/types';
import { tryAutoSaveVideo } from '../../../src/features/devlens/services/auto-save';
import { formatDuration } from '../../../src/shared/utils/format';

export async function fetchIgVideoUrl(shortcode: string): Promise<string> {
  const resp = await fetch(`https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`, {
    credentials: 'include',
    headers: {
      'X-IG-App-ID': '936619743392459',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
  if (!resp.ok) throw new Error(`Instagram API HTTP ${resp.status}`);
  const json = await resp.json();

  const item = json.items?.[0];
  if (!item) throw new Error('게시물을 찾을 수 없습니다');

  if (item.video_versions && item.video_versions.length > 0) {
    let best = item.video_versions[0];
    for (const v of item.video_versions) {
      if ((v.width || 0) > (best.width || 0)) best = v;
    }
    return best.url;
  }

  if (item.video_url) return item.video_url;

  throw new Error('영상 URL을 찾을 수 없습니다');
}

export async function processVideo(
  videoInfo: any,
  sendToPanel: (msg: any) => void,
): Promise<void> {
  sendToPanel({ action: 'videoLoading' });

  let pageUrl: string | null = null;
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.url) pageUrl = activeTab.url;
  } catch { /* ignore */ }

  const data: any = {
    ...videoInfo,
    pageUrl,
    durationFormatted: formatDuration(videoInfo.duration),
  };

  if (videoInfo.igUsername) data.igUsername = videoInfo.igUsername;
  if (videoInfo.igShortcode) data.igShortcode = videoInfo.igShortcode;

  // If stream URL is a segment base (no manifest found), try common manifest names
  if (videoInfo.streamUrl && videoInfo.streamType === 'hls_base') {
    const base = videoInfo.streamUrl;
    const candidates = ['index.m3u8', 'master.m3u8', 'playlist.m3u8', 'manifest.m3u8', 'stream.m3u8', 'chunklist.m3u8'];
    for (const name of candidates) {
      try {
        const testUrl = base + name;
        const resp = await fetch(testUrl);
        if (resp.ok) {
          const text = await resp.text();
          if (text.includes('#EXTM3U')) {
            data.streamUrl = testUrl;
            data.streamType = 'hls';
            data.manifestContent = text;
            const headers: Record<string, string> = {};
            resp.headers.forEach((v, k) => { headers[k] = v; });
            data.headers = headers;
            data.segmentCount = text.split('\n').filter((l: string) => l.trim() && !l.startsWith('#')).length;
            break;
          }
        }
      } catch { /* ignore */ }
    }
  }

  // If it's an HLS stream, try to fetch the manifest
  if (videoInfo.streamUrl && (videoInfo.streamType === 'hls' || data.streamType === 'hls')) {
    const manifestUrl = data.streamUrl || videoInfo.streamUrl;
    if (!data.manifestContent) {
      try {
        const resp = await fetch(manifestUrl);
        const text = await resp.text();
        const headers: Record<string, string> = {};
        resp.headers.forEach((v, k) => { headers[k] = v; });
        data.manifestContent = text;
        data.headers = headers;
        data.segmentCount = text.split('\n').filter((l: string) => l.trim() && !l.startsWith('#')).length;
      } catch { /* ignore */ }
    }
  }

  // If direct video URL, try HEAD to get size/headers
  if (!videoInfo.isBlob && videoInfo.src) {
    try {
      const resp = await fetch(videoInfo.src, { method: 'HEAD' });
      const headers: Record<string, string> = {};
      resp.headers.forEach((v, k) => { headers[k] = v; });
      data.headers = headers;
      data.fileSize = parseInt(headers['content-length'] || '0');
    } catch { /* ignore */ }
  }

  sendToPanel({ action: 'videoData', data });

  await tryAutoSaveVideo(data as VideoData, pageUrl, sendToPanel, fetchIgVideoUrl);
}
