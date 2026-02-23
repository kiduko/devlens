// ── Offscreen Document for Video Segment Download & Merge ──
// Uses OPFS (Origin Private File System) for disk-based streaming writes.
// This avoids holding entire video in memory, enabling 1GB+ downloads.

const CONCURRENT = 4;
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB per range request

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'downloadHLS') {
    downloadHLS(msg.manifestUrl, msg.baseUrl, msg.filename);
  }
  if (msg.action === 'downloadDirect') {
    downloadDirect(msg.url, msg.filename, msg.expectedSize || 0);
  }
});

// Keep service worker alive with heartbeat
setInterval(() => {
  chrome.runtime.sendMessage({ action: 'heartbeat' }).catch(() => {});
}, 20000);

// ── OPFS helpers ──

async function getOPFSWritable(name: string): Promise<{ handle: FileSystemFileHandle; writable: FileSystemWritableFileStream }> {
  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  return { handle, writable };
}

async function getOPFSBlob(handle: FileSystemFileHandle): Promise<File> {
  return handle.getFile();
}

async function cleanupOPFS(name: string): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(name);
  } catch { /* ignore */ }
}

// ── HLS Download ──

async function downloadHLS(manifestUrl: string, baseUrl: string, filename: string): Promise<void> {
  try {
    sendProgress('parse', 0, 'M3U8 파싱 중...');

    const resp = await fetch(manifestUrl);
    const text = await resp.text();
    let segments = parseM3U8(text, baseUrl || manifestUrl);

    if (segments.length === 0) {
      const variant = parseMasterPlaylist(text, baseUrl || manifestUrl);
      if (variant) {
        const varResp = await fetch(variant.url);
        const varText = await varResp.text();
        const varBase = variant.url.substring(0, variant.url.lastIndexOf('/') + 1);
        segments = parseM3U8(varText, varBase);
      }
      if (segments.length === 0) {
        sendProgress('error', 0, '세그먼트를 찾을 수 없습니다');
        return;
      }
    }

    await downloadSegments(segments, filename);
  } catch (err: any) {
    sendProgress('error', 0, err.message);
  }
}

function parseM3U8(text: string, baseUrl: string): string[] {
  const lines = text.split('\n').map(l => l.trim());
  const segments: string[] = [];
  const base = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);

  for (const line of lines) {
    if (line.startsWith('#') || line === '') continue;
    const url = line.startsWith('http') ? line : base + line;
    segments.push(url);
  }
  return segments;
}

function parseMasterPlaylist(text: string, baseUrl: string): { url: string; bandwidth: number } | null {
  const lines = text.split('\n').map(l => l.trim());
  const base = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
  let bestBandwidth = 0;
  let bestUrl: string | null = null;
  let nextIsBest = false;

  for (const line of lines) {
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const bwMatch = line.match(/BANDWIDTH=(\d+)/);
      const bw = bwMatch ? parseInt(bwMatch[1]) : 0;
      if (bw >= bestBandwidth) {
        bestBandwidth = bw;
        nextIsBest = true;
      }
    } else if (nextIsBest && !line.startsWith('#') && line !== '') {
      bestUrl = line.startsWith('http') ? line : base + line;
      nextIsBest = false;
    }
  }

  return bestUrl ? { url: bestUrl, bandwidth: bestBandwidth } : null;
}

// ── HLS Segment Download (streams to OPFS) ──

async function downloadSegments(segments: string[], filename: string): Promise<void> {
  const total = segments.length;
  const outputName = (filename || 'video').replace(/\.[^.]+$/, '') + '.ts';
  const tempName = '_devlens_temp_' + Date.now() + '.ts';

  let downloaded = 0;
  let totalBytes = 0;

  sendProgress('downloading', 0, `0 / ${total} 세그먼트`);

  const { handle, writable } = await getOPFSWritable(tempName);

  try {
    for (let i = 0; i < total; i += CONCURRENT) {
      const batch = segments.slice(i, i + CONCURRENT);
      const results = await Promise.all(
        batch.map(async (url, idx) => {
          const globalIdx = i + idx;
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const resp = await fetch(url);
              if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
              const buf = await resp.arrayBuffer();
              return { idx: globalIdx, buf };
            } catch {
              if (attempt === 1) return { idx: globalIdx, buf: new ArrayBuffer(0) };
            }
          }
          return { idx: globalIdx, buf: new ArrayBuffer(0) };
        })
      );

      results.sort((a, b) => a.idx - b.idx);
      for (const r of results) {
        if (r.buf.byteLength > 0) {
          await writable.write(new Uint8Array(r.buf));
        }
        totalBytes += r.buf.byteLength;
        downloaded++;
      }

      const pct = Math.round((downloaded / total) * 100);
      const sizeMB = (totalBytes / 1048576).toFixed(1);
      sendProgress('downloading', pct, `${downloaded}/${total} 세그먼트 (${sizeMB} MB)`);
    }

    await writable.close();

    sendProgress('saving', 98, '저장 중...');

    const blob = await getOPFSBlob(handle);
    await saveBlob(blob, outputName);

    sendProgress('done', 100, `완료 (${(totalBytes / 1048576).toFixed(1)} MB)`);
  } catch (err: any) {
    try { await writable.close(); } catch { /* ignore */ }
    sendProgress('error', 0, err.message);
  } finally {
    setTimeout(() => cleanupOPFS(tempName), 120000);
  }
}

// ── Direct Video Download (streams to OPFS) ──

function fixVideoFilename(filename: string, contentType: string | null): string {
  let name = filename || 'video';
  if (/\.(mp4|webm|mkv|avi|mov|ts|m4v|m4a|mp3|aac|ogg|flv)$/i.test(name)) return name;
  const extMap: Record<string, string> = {
    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/x-matroska': '.mkv',
    'video/quicktime': '.mov', 'video/mp2t': '.ts', 'video/x-flv': '.flv',
    'audio/mp4': '.m4a', 'audio/mpeg': '.mp3', 'audio/webm': '.webm',
    'audio/aac': '.aac', 'audio/ogg': '.ogg',
  };
  if (contentType) {
    const ct = contentType.split(';')[0].trim().toLowerCase();
    if (extMap[ct]) return name + extMap[ct];
  }
  return name + '.mp4';
}

async function downloadDirect(url: string, filename: string, expectedSize: number): Promise<void> {
  const tempName = '_devlens_temp_' + Date.now();
  const isYoutube = url.includes('googlevideo.com') || url.includes('videoplayback');

  try {
    sendProgress('downloading', 0, '다운로드 시작...');

    if (isYoutube && expectedSize > 0) {
      const saveName = fixVideoFilename(filename, null);
      await downloadRanged(url, saveName, expectedSize, tempName);
      return;
    }

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const contentType = resp.headers.get('content-type') || '';
    const saveName = fixVideoFilename(filename, contentType);
    const totalSize = parseInt(resp.headers.get('content-length') || '0') || expectedSize || 0;

    const reader = resp.body!.getReader();
    const { handle, writable } = await getOPFSWritable(tempName);
    let received = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        await writable.write(value);
        received += value.length;

        const pct = totalSize > 0 ? Math.round((received / totalSize) * 100) : 0;
        const sizeMB = (received / 1048576).toFixed(1);
        sendProgress('downloading', pct,
          `${sizeMB} MB${totalSize > 0 ? ' / ' + (totalSize / 1048576).toFixed(1) + ' MB' : ''}`);
      }

      await writable.close();

      sendProgress('saving', 98, '저장 중...');
      const blob = await getOPFSBlob(handle);
      await saveBlob(blob, saveName);
      sendProgress('done', 100, `완료 (${(received / 1048576).toFixed(1)} MB)`);
    } catch (err) {
      try { await writable.close(); } catch { /* ignore */ }
      throw err;
    } finally {
      setTimeout(() => cleanupOPFS(tempName), 120000);
    }
  } catch (err: any) {
    sendProgress('error', 0, err.message);
  }
}

// ── Range-based Chunked Download ──

async function downloadRanged(url: string, filename: string, totalSize: number, tempName: string): Promise<void> {
  const { handle, writable } = await getOPFSWritable(tempName);
  let received = 0;

  try {
    const totalMB = (totalSize / 1048576).toFixed(1);

    while (received < totalSize) {
      const end = Math.min(received + CHUNK_SIZE - 1, totalSize - 1);
      const resp = await fetch(url, {
        headers: { 'Range': `bytes=${received}-${end}` },
      });

      if (!resp.ok && resp.status !== 206) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const reader = resp.body!.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writable.write(value);
        received += value.length;

        const pct = Math.round((received / totalSize) * 100);
        const sizeMB = (received / 1048576).toFixed(1);
        sendProgress('downloading', pct, `${sizeMB} / ${totalMB} MB`);
      }
    }

    await writable.close();

    sendProgress('saving', 98, '저장 중...');
    const blob = await getOPFSBlob(handle);
    await saveBlob(blob, fixVideoFilename(filename, null));
    sendProgress('done', 100, `완료 (${(received / 1048576).toFixed(1)} MB)`);
  } catch (err: any) {
    try { await writable.close(); } catch { /* ignore */ }
    sendProgress('error', 0, err.message);
    throw err;
  } finally {
    setTimeout(() => cleanupOPFS(tempName), 120000);
  }
}

// ── Save ──

async function saveBlob(blob: Blob, filename: string): Promise<void> {
  const ext = (filename.match(/\.(\w+)$/) || [])[1] || 'mp4';
  const mimeMap: Record<string, string> = {
    mp4: 'video/mp4', webm: 'video/webm', ts: 'video/mp2t',
    mkv: 'video/x-matroska', mov: 'video/quicktime',
    m4a: 'audio/mp4', mp3: 'audio/mpeg', aac: 'audio/aac',
  };
  const typed = new Blob([blob], { type: mimeMap[ext] || 'video/mp4' });
  const url = URL.createObjectURL(typed);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}

// ── Utils ──

function sendProgress(stage: string, percent: number, message: string): void {
  chrome.runtime.sendMessage({
    action: 'videoProgress',
    stage,
    percent,
    message,
  }).catch(() => {});
}
