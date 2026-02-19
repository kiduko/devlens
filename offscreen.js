// ── Offscreen Document for Video Segment Download & Merge ──
// Uses OPFS (Origin Private File System) for disk-based streaming writes.
// This avoids holding entire video in memory, enabling 1GB+ downloads.

const CONCURRENT = 4; // parallel segment downloads

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'downloadHLS') {
    downloadHLS(msg.manifestUrl, msg.baseUrl, msg.filename);
  }
  if (msg.action === 'downloadDirect') {
    downloadDirect(msg.url, msg.filename);
  }
});

// Keep service worker alive with heartbeat
setInterval(() => {
  chrome.runtime.sendMessage({ action: 'heartbeat' }).catch(() => {});
}, 20000);

// ── OPFS helpers ──

async function getOPFSWritable(name) {
  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  return { handle, writable };
}

async function getOPFSBlob(handle) {
  const file = await handle.getFile();
  return file;
}

async function cleanupOPFS(name) {
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(name);
  } catch {}
}

// ── HLS Download ──

async function downloadHLS(manifestUrl, baseUrl, filename) {
  try {
    sendProgress('parse', 0, 'M3U8 파싱 중...');

    const resp = await fetch(manifestUrl);
    const text = await resp.text();
    let segments = parseM3U8(text, baseUrl || manifestUrl);

    if (segments.length === 0) {
      // Maybe it's a master playlist — find the best quality variant
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
  } catch (err) {
    sendProgress('error', 0, err.message);
  }
}

function parseM3U8(text, baseUrl) {
  const lines = text.split('\n').map(l => l.trim());
  const segments = [];
  const base = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);

  for (const line of lines) {
    if (line.startsWith('#') || line === '') continue;
    const url = line.startsWith('http') ? line : base + line;
    segments.push(url);
  }
  return segments;
}

function parseMasterPlaylist(text, baseUrl) {
  const lines = text.split('\n').map(l => l.trim());
  const base = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
  let bestBandwidth = 0;
  let bestUrl = null;
  let nextIsBest = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
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

async function downloadSegments(segments, filename) {
  const total = segments.length;
  const outputName = (filename || 'video').replace(/\.[^.]+$/, '') + '.ts';
  const tempName = '_devlens_temp_' + Date.now() + '.ts';

  let downloaded = 0;
  let totalBytes = 0;

  sendProgress('downloading', 0, `0 / ${total} 세그먼트`);

  // Open OPFS file for streaming writes
  const { handle, writable } = await getOPFSWritable(tempName);

  try {
    // Download in batches of CONCURRENT, write each batch to disk immediately
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
            } catch (err) {
              if (attempt === 1) return { idx: globalIdx, buf: new ArrayBuffer(0) };
            }
          }
        })
      );

      // Sort by index to maintain segment order, then write to disk
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

    // Finalize the file
    await writable.close();

    sendProgress('saving', 98, '저장 중...');

    // Read back as blob for chrome.downloads
    const blob = await getOPFSBlob(handle);
    await saveBlob(blob, outputName);

    sendProgress('done', 100, `완료 (${(totalBytes / 1048576).toFixed(1)} MB)`);
  } catch (err) {
    try { await writable.close(); } catch {}
    sendProgress('error', 0, err.message);
  } finally {
    // Clean up temp file (after delay so download can start)
    setTimeout(() => cleanupOPFS(tempName), 120000);
  }
}

// ── Direct Video Download (streams to OPFS) ──

async function downloadDirect(url, filename) {
  const tempName = '_devlens_temp_' + Date.now() + '.mp4';

  try {
    sendProgress('downloading', 0, '다운로드 시작...');

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const contentLength = parseInt(resp.headers.get('content-length') || '0');
    const reader = resp.body.getReader();

    // Stream directly to OPFS — never hold entire file in memory
    const { handle, writable } = await getOPFSWritable(tempName);
    let received = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        await writable.write(value);
        received += value.length;

        const pct = contentLength > 0 ? Math.round((received / contentLength) * 100) : 0;
        const sizeMB = (received / 1048576).toFixed(1);
        sendProgress('downloading', pct,
          `${sizeMB} MB${contentLength > 0 ? ' / ' + (contentLength / 1048576).toFixed(1) + ' MB' : ''}`);
      }

      await writable.close();

      sendProgress('saving', 98, '저장 중...');
      const blob = await getOPFSBlob(handle);
      await saveBlob(blob, filename || 'video.mp4');
      sendProgress('done', 100, `완료 (${(received / 1048576).toFixed(1)} MB)`);
    } catch (err) {
      try { await writable.close(); } catch {}
      throw err;
    } finally {
      setTimeout(() => cleanupOPFS(tempName), 120000);
    }
  } catch (err) {
    sendProgress('error', 0, err.message);
  }
}

// ── Save ──

async function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  chrome.runtime.sendMessage({
    action: 'saveVideoBlob',
    url,
    filename,
  });
  // Revoke after download has time to start
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}

// ── Utils ──

function sendProgress(stage, percent, message) {
  chrome.runtime.sendMessage({
    action: 'videoProgress',
    stage,
    percent,
    message,
  }).catch(() => {});
}
