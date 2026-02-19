const $ = (sel) => document.querySelector(sel);

let currentSrc = null;
let originalSrc = null;
let currentImageData = null;
let currentVideoData = null;
let detectedUrlParams = [];
let previousImageData = null;  // 비교용: 이전 이미지 정보 저장
let pendingCompare = false;    // 비교 대기 상태
const imageHistory = [];
const MAX_HISTORY = 20;

// ── Settings ──

const DEFAULT_SETTINGS = {
  autoSave: false,
  filePrefix: 'devlens_',
  saveFormat: 'original',
  enableHistory: false,
};

let settings = { ...DEFAULT_SETTINGS };

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get('devlensSettings', (result) => {
      if (result.devlensSettings) {
        settings = { ...DEFAULT_SETTINGS, ...result.devlensSettings };
      }
      applySettingsToUI();
      resolve(settings);
    });
  });
}

function saveSettings() {
  chrome.storage.local.set({ devlensSettings: settings });
}

function applySettingsToUI() {
  $('#autoSaveToggle').checked = settings.autoSave;
  $('#historyToggle').checked = settings.enableHistory;
  $('#filePrefix').value = settings.filePrefix;
  $('#saveFormat').value = settings.saveFormat;
  renderHistory();
}

// ── Port connection to background ──
const port = chrome.runtime.connect({ name: 'sidepanel' });

port.onMessage.addListener((msg) => {
  if (msg.action === 'imageLoading') {
    currentSrc = msg.src;
    showState('loading');
  }
  if (msg.action === 'imageData') {
    currentImageData = msg.data;
    currentVideoData = null;
    showState('info');
    renderImageInfo(msg.data);
    addToHistory(msg.data.src);
  }
  if (msg.action === 'imageError') {
    currentImageData = null;
    currentVideoData = null;
    showState('info');
    renderImageInfo({ src: msg.src, error: msg.error });
    addToHistory(msg.src);
  }
  if (msg.action === 'videoLoading') {
    showState('loading');
  }
  if (msg.action === 'videoData') {
    currentVideoData = msg.data;
    currentImageData = null;
    currentSrc = msg.data.src;
    showState('video');
    renderVideoInfo(msg.data);
  }
  if (msg.action === 'videoProgress') {
    updateVideoProgress(msg.stage, msg.percent, msg.message);
  }
  if (msg.action === 'streamDetected') {
    // Could show a notification, but for now just store it
  }
  if (msg.action === 'downloadComplete') {
    toast(`저장됨: ${msg.path}`);
  }
});

// ── State ──

function showState(state) {
  $('#emptyState').classList.toggle('hidden', state !== 'empty');
  $('#loadingState').classList.toggle('hidden', state !== 'loading');
  $('#imageInfo').classList.toggle('hidden', state !== 'info');
  $('#videoInfo').classList.toggle('hidden', state !== 'video');
}

// ── Render ──

function renderImageInfo(data) {
  const { src, contentType, fileSize, headers, pageInfo, exif, status, statusText, error } = data;
  currentSrc = src;
  // Only set originalSrc on first load (not on param-apply refetch)
  if (!originalSrc || !detectedUrlParams.length || detectedUrlParams.every(p => p.value === p.originalValue)) {
    originalSrc = src;
    // 새 이미지 선택 시 비교 상태 초기화
    if (!pendingCompare) {
      previousImageData = null;
    }
  }
  $('#thumbImg').src = data.thumbDataUrl || src;

  const container = $('#infoSections');
  container.innerHTML = '';

  // Toggle actions that don't apply to base64
  const isBase64Src = src.startsWith('data:');
  $('#btnOpenTab').classList.toggle('disabled', isBase64Src);
  $('#btnCopyCurl').classList.toggle('disabled', isBase64Src);

  if (error) {
    container.innerHTML = `<div class="no-exif">${esc(error)}</div>`;
    return;
  }

  // 1) Basic info
  const isBase64 = src.startsWith('data:');
  const basicRows = [];

  if (isBase64) {
    const mimeMatch = src.match(/^data:([^;,]+)/);
    const mime = mimeMatch ? mimeMatch[1] : 'unknown';
    basicRows.push(['소스', '<span class="badge base64">Base64</span>', true]);
    basicRows.push(['포맷', formatContentType(mime)]);
    basicRows.push(['데이터 크기', formatFileSize(fileSize)]);
  } else {
    basicRows.push(['포맷', formatContentType(contentType)]);
    basicRows.push(['파일 크기', formatFileSize(fileSize)]);
  }

  if (pageInfo) {
    if (pageInfo.naturalWidth && pageInfo.naturalHeight)
      basicRows.push(['원본 크기', `${pageInfo.naturalWidth} x ${pageInfo.naturalHeight}`]);
    if (pageInfo.renderWidth && pageInfo.renderHeight)
      basicRows.push(['렌더 크기', `${pageInfo.renderWidth} x ${pageInfo.renderHeight}`]);
    if (pageInfo.alt) basicRows.push(['Alt 텍스트', pageInfo.alt]);
  }

  if (!isBase64) {
    basicRows.push(['URL', truncateUrl(src)]);
  }
  container.appendChild(createSection('기본 정보', basicRows, false));

  // 1.4) Compare banner (after param-best / param-apply refetch)
  if (pendingCompare && previousImageData) {
    pendingCompare = false;
    currentImageData = data;
    const prev = previousImageData;
    const prevSize = prev.fileSize || 0;
    const newSize = fileSize || 0;
    const prevW = prev.pageInfo?.naturalWidth || 0;
    const prevH = prev.pageInfo?.naturalHeight || 0;
    const newW = pageInfo?.naturalWidth || 0;
    const newH = pageInfo?.naturalHeight || 0;

    const sizeChange = prevSize > 0 ? (((newSize - prevSize) / prevSize) * 100).toFixed(1) : '?';
    const bigger = newSize > prevSize;
    const dimChanged = (newW !== prevW || newH !== prevH);

    const banner = document.createElement('div');
    banner.className = 'compare-banner';
    banner.innerHTML = `
      <div class="compare-title">변경 결과 비교</div>
      <div class="compare-grid">
        <div class="compare-col">
          <span class="compare-label">이전</span>
          <span class="compare-val">${formatFileSize(prevSize)}</span>
          ${prevW ? `<span class="compare-dim">${prevW}x${prevH}</span>` : ''}
        </div>
        <div class="compare-arrow">${bigger ? '▲' : '▼'}</div>
        <div class="compare-col">
          <span class="compare-label">현재</span>
          <span class="compare-val">${formatFileSize(newSize)}</span>
          ${newW ? `<span class="compare-dim">${newW}x${newH}</span>` : ''}
        </div>
      </div>
      <div class="compare-diff ${bigger ? 'positive' : 'negative'}">
        용량 ${bigger ? '+' : ''}${sizeChange}%${dimChanged ? ` · 해상도 ${newW}x${newH}` : ''}
      </div>
      <div class="compare-actions">
        <button type="button" class="action-btn primary" data-action="compare-keep">유지</button>
        <button type="button" class="action-btn" data-action="compare-revert">되돌리기</button>
      </div>
    `;
    container.appendChild(banner);
  } else {
    currentImageData = data;
  }

  // 1.5) AI Detection
  if (data.aiInfo && data.aiInfo.signals.length > 0) {
    const ai = data.aiInfo;
    const aiSection = document.createElement('div');
    aiSection.className = 'info-section';
    const aiHeader = document.createElement('div');
    aiHeader.className = 'info-section-header';
    aiHeader.textContent = 'AI 생성 분석';
    aiHeader.addEventListener('click', () => aiSection.classList.toggle('collapsed'));
    const aiBody = document.createElement('div');
    aiBody.className = 'info-section-body access-body';

    // Verdict badge
    const verdict = document.createElement('div');
    if (ai.isAI) {
      const confLabel = { high: '높음', medium: '보통', low: '낮음' }[ai.confidence] || '';
      verdict.className = 'ai-verdict ai-detected';
      verdict.innerHTML = `<span class="ai-verdict-icon">🤖</span>
        <div class="ai-verdict-text">
          <span class="ai-verdict-label">AI 생성 이미지${ai.tool ? ` — ${esc(ai.tool)}` : ''}</span>
          <span class="ai-verdict-conf">신뢰도: ${confLabel} (신호 ${ai.signals.length}개)</span>
        </div>`;
    } else {
      verdict.className = 'ai-verdict ai-none';
      verdict.innerHTML = `<span class="ai-verdict-icon">📷</span>
        <div class="ai-verdict-text">
          <span class="ai-verdict-label">AI 생성 흔적 없음</span>
          <span class="ai-verdict-conf">메타데이터에서 AI 신호 미감지</span>
        </div>`;
    }
    aiBody.appendChild(verdict);

    // C2PA badge
    if (ai.c2pa && ai.c2pa.found) {
      const c2paTag = document.createElement('div');
      c2paTag.className = 'access-tag info';
      c2paTag.innerHTML = `<span class="access-icon">🛡️</span>
        <div class="access-detail">
          <span class="access-name">C2PA Content Credentials</span>
          <span class="access-desc">${ai.c2pa.claimGenerator ? esc(ai.c2pa.claimGenerator) : '서명된 출처 정보 포함'}</span>
        </div>`;
      aiBody.appendChild(c2paTag);
    }

    // Detail signals
    for (const sig of ai.signals) {
      if (sig.type === 'c2pa') continue;
      const tag = document.createElement('div');
      const level = sig.isAI || sig.tool ? 'warn' : 'detail';
      tag.className = `access-tag ${level}`;
      const label = sig.tool ? `${sig.field} → ${sig.tool}` : sig.field;
      const val = sig.value && sig.value.length > 150 ? sig.value.substring(0, 150) + '…' : (sig.value || '');
      tag.innerHTML = `<span class="access-icon">${sig.isAI || sig.tool ? '⚠️' : 'ℹ️'}</span>
        <div class="access-detail">
          <span class="access-name">${esc(label)} <span style="opacity:0.5;font-weight:400">[${sig.type}]</span></span>
          <span class="access-desc">${esc(val)}</span>
        </div>`;
      aiBody.appendChild(tag);
    }

    aiSection.appendChild(aiHeader);
    aiSection.appendChild(aiBody);
    container.appendChild(aiSection);
  }

  // 2) Access & Auth analysis
  if (!isBase64) {
    const accessInfo = analyzeAccess(src, headers || {}, data.credentialMode, status, data.cookieInfo, data.urlAuthParams);
    if (accessInfo.length > 0) {
      const accessSection = document.createElement('div');
      accessSection.className = 'info-section';
      const accessHeader = document.createElement('div');
      accessHeader.className = 'info-section-header';
      accessHeader.textContent = '접근 권한';
      accessHeader.addEventListener('click', () => accessSection.classList.toggle('collapsed'));
      const accessBody = document.createElement('div');
      accessBody.className = 'info-section-body access-body';
      for (const item of accessInfo) {
        const tag = document.createElement('div');
        tag.className = `access-tag ${item.level}`;
        tag.innerHTML = `
          <span class="access-icon">${item.icon}</span>
          <div class="access-detail">
            <span class="access-name">${esc(item.label)}</span>
            <span class="access-desc">${esc(item.desc)}</span>
          </div>
        `;
        accessBody.appendChild(tag);
      }
      accessSection.appendChild(accessHeader);
      accessSection.appendChild(accessBody);
      container.appendChild(accessSection);
    }
  }

  // 3) HTTP Headers
  if (headers && Object.keys(headers).length > 0) {
    const hdrRows = [];
    if (status) hdrRows.push(['Status', `${status} ${statusText || ''}`]);
    for (const [k, v] of Object.entries(headers)) {
      hdrRows.push([k, v]);
    }
    container.appendChild(createSection('HTTP 응답 헤더', hdrRows, false));
  }

  // 4) EXIF
  if (exif && exif.formatted && Object.keys(exif.formatted).length > 0) {
    const groups = [
      { title: '카메라', keys: ['카메라 제조사','카메라 모델','렌즈 제조사','렌즈 모델','소프트웨어'] },
      { title: '촬영 설정', keys: ['셔터 속도','조리개','ISO','초점 거리','35mm 환산','노출 보정','노출 모드','측광 모드','플래시'] },
      { title: '메타데이터', keys: ['촬영 일시','색 공간','원본 크기','작가','저작권'] },
      { title: '위치', keys: ['GPS 위치','고도'] },
    ];
    for (const group of groups) {
      const rows = [];
      for (const key of group.keys) {
        if (exif.formatted[key] == null) continue;
        if (key === 'GPS 위치' && exif.gps) {
          rows.push([key, `<a href="https://www.google.com/maps?q=${exif.gps.lat},${exif.gps.lng}" target="_blank">${esc(exif.formatted[key])}</a>`, true]);
        } else {
          rows.push([key, String(exif.formatted[key])]);
        }
      }
      if (rows.length > 0) container.appendChild(createSection(group.title, rows, false));
    }
  } else {
    container.innerHTML += `<div class="no-exif">EXIF 데이터가 없습니다</div>`;
  }

  // 5) URL Parameter Analysis (최하단)
  if (!isBase64) {
    detectedUrlParams = analyzeImageUrl(src);
    renderUrlParams(detectedUrlParams, container);
  } else {
    detectedUrlParams = [];
  }
}

function createSection(title, rows, collapsed) {
  const section = document.createElement('div');
  section.className = 'info-section' + (collapsed ? ' collapsed' : '');

  const header = document.createElement('div');
  header.className = 'info-section-header';
  header.textContent = title;
  header.addEventListener('click', () => section.classList.toggle('collapsed'));

  const body = document.createElement('div');
  body.className = 'info-section-body';

  for (const item of rows) {
    const [label, value, isHtml] = item;
    const row = document.createElement('div');
    row.className = 'info-row';
    const labelSpan = document.createElement('span');
    labelSpan.className = 'info-label';
    labelSpan.textContent = label;
    const valueSpan = document.createElement('span');
    const isUrl = (label === 'URL' || label === '스트림 URL' || label === '소스');
    valueSpan.className = 'info-value' + (isUrl && !isHtml ? ' url-value' : '');
    if (isHtml) {
      valueSpan.innerHTML = value;
    } else {
      valueSpan.textContent = value;
      if (isUrl) valueSpan.title = value;
    }
    row.appendChild(labelSpan);
    row.appendChild(valueSpan);
    body.appendChild(row);
  }

  section.appendChild(header);
  section.appendChild(body);
  return section;
}

// ── Video Render ──

function renderVideoInfo(data) {
  const { src, poster, frameThumbnail, duration, durationFormatted, videoWidth, videoHeight,
          renderWidth, renderHeight, isBlob, streamUrl, streamType,
          headers, fileSize, segmentCount, pageUrl } = data;
  currentSrc = src;

  const posterEl = $('#videoPoster');
  const videoEl = $('#videoPreview');

  // Direct (non-blob) URL → playable video preview
  if (!isBlob && src) {
    posterEl.classList.add('hidden');
    videoEl.src = src;
    videoEl.classList.remove('hidden');
  } else {
    // Blob or no direct URL → show captured frame or poster
    videoEl.pause();
    videoEl.removeAttribute('src');
    videoEl.classList.add('hidden');

    const thumb = frameThumbnail || poster;
    if (thumb) {
      posterEl.src = thumb;
      posterEl.classList.remove('hidden');
    } else {
      posterEl.src = '';
      posterEl.classList.add('hidden');
    }
  }

  const container = $('#videoSections');
  container.innerHTML = '';

  // Basic info
  const basicRows = [];
  if (durationFormatted) basicRows.push(['재생 시간', durationFormatted]);
  if (videoWidth && videoHeight) basicRows.push(['원본 크기', `${videoWidth} x ${videoHeight}`]);
  if (renderWidth && renderHeight) basicRows.push(['렌더 크기', `${renderWidth} x ${renderHeight}`]);
  if (fileSize) basicRows.push(['파일 크기', formatFileSize(fileSize)]);
  if (streamType) basicRows.push(['스트림 타입', streamType.toUpperCase()]);
  if (segmentCount) basicRows.push(['세그먼트 수', `${segmentCount}개`]);
  basicRows.push(['소스', isBlob ? 'Blob (스트리밍)' : truncateUrl(src)]);
  if (streamUrl) basicRows.push(['스트림 URL', truncateUrl(streamUrl)]);
  container.appendChild(createSection('기본 정보', basicRows, false));

  // HTTP Headers
  if (headers && Object.keys(headers).length > 0) {
    const hdrRows = [];
    for (const [k, v] of Object.entries(headers)) {
      hdrRows.push([k, v]);
    }
    container.appendChild(createSection('HTTP 응답 헤더', hdrRows, false));
  }

  // Download capability info
  const dlRows = [];
  if (streamUrl) {
    dlRows.push(['다운로드 방식', streamType === 'hls' ? 'HLS 세그먼트 병합' : 'DASH 세그먼트 병합']);
  } else if (!isBlob) {
    dlRows.push(['다운로드 방식', '직접 다운로드']);
  } else {
    dlRows.push(['다운로드 방식', '불가 (스트림 URL 미감지)']);
  }
  container.appendChild(createSection('다운로드', dlRows, false));

  // Reset progress
  $('#videoProgress').classList.add('hidden');
}

function updateVideoProgress(stage, percent, message) {
  const progressEl = $('#videoProgress');
  const fillEl = $('#progressFill');
  const textEl = $('#progressText');

  if (stage === 'done') {
    fillEl.style.width = '100%';
    fillEl.classList.add('done');
    textEl.textContent = message;
    setTimeout(() => { progressEl.classList.add('hidden'); }, 3000);
    return;
  }

  if (stage === 'error') {
    fillEl.style.width = '100%';
    fillEl.classList.add('error');
    textEl.textContent = message;
    return;
  }

  progressEl.classList.remove('hidden');
  fillEl.classList.remove('done', 'error');
  fillEl.style.width = `${percent}%`;
  textEl.textContent = message;
}

function generateVideoCurl() {
  const url = currentVideoData?.streamUrl || currentVideoData?.src;
  if (!url || url.startsWith('blob:')) return null;
  const parts = [`curl '${escShell(url)}'`];
  if (currentVideoData?.pageUrl) {
    parts.push(`  -H 'referer: ${escShell(currentVideoData.pageUrl)}'`);
  }
  parts.push(`  -H 'user-agent: ${escShell(navigator.userAgent)}'`);
  parts.push(`  -o '${escShell(extractVideoFilenameForCurl())}'`);
  return parts.join(' \\\n');
}

function extractVideoFilenameForCurl() {
  if (currentVideoData?.streamUrl) {
    try {
      const name = new URL(currentVideoData.streamUrl).pathname.split('/').pop();
      if (name) return name;
    } catch {}
  }
  if (currentVideoData?.src && !currentVideoData.isBlob) {
    try {
      const name = new URL(currentVideoData.src).pathname.split('/').pop();
      if (name) return name;
    } catch {}
  }
  return 'video.mp4';
}

// ── History ──

function addToHistory(src) {
  if (!settings.enableHistory) return;
  const idx = imageHistory.findIndex(h => h.src === src);
  if (idx !== -1) imageHistory.splice(idx, 1);
  imageHistory.unshift({ src });
  if (imageHistory.length > MAX_HISTORY) imageHistory.pop();
  renderHistory();
}

function renderHistory() {
  const container = $('#history');
  if (!container) return;
  const grid = $('#historyGrid');
  if (!settings.enableHistory || imageHistory.length === 0) {
    container.classList.add('empty');
    return;
  }
  container.classList.remove('empty');
  grid.innerHTML = '';
  for (const item of imageHistory) {
    const el = document.createElement('div');
    el.className = 'history-item' + (item.src === currentSrc ? ' active' : '');
    const img = document.createElement('img');
    img.src = item.src;
    el.appendChild(img);
    el.addEventListener('click', () => {
      port.postMessage({ action: 'refetchImage', src: item.src });
    });
    grid.appendChild(el);
  }
}

// ── Actions ──

$('#btnDownload').addEventListener('click', () => {
  if (!currentSrc) return;
  port.postMessage({ action: 'downloadImage', url: currentSrc, filename: extractFilename(currentSrc) });
});

$('#btnCopyUrl').addEventListener('click', async () => {
  if (!currentSrc) return;
  try {
    const response = await fetch(currentSrc, { credentials: 'include' });
    const originalBlob = await response.blob();

    // Clipboard API requires PNG
    let pngBlob;
    if (originalBlob.type === 'image/png') {
      pngBlob = originalBlob;
    } else {
      const bitmap = await createImageBitmap(originalBlob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      pngBlob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    }

    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
    toast('이미지가 복사되었습니다');
  } catch {
    // Fallback: copy URL text
    navigator.clipboard.writeText(currentSrc).then(() => toast('URL이 복사되었습니다'));
  }
});

$('#btnOpenTab').addEventListener('click', () => {
  if (!currentSrc || currentSrc.startsWith('data:')) return;
  window.open(currentSrc, '_blank');
});

$('#btnCopyCurl').addEventListener('click', () => {
  if (!currentSrc || currentSrc.startsWith('data:')) return;
  const curl = generateCurl();
  navigator.clipboard.writeText(curl).then(() => toast('cURL이 복사되었습니다'));
});

// ── URL Param Buttons (event delegation) ──
$('#infoSections').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  e.stopPropagation();

  const action = btn.getAttribute('data-action');
  if (action === 'param-best') {
    const bestUrl = buildBestQualityUrl(originalSrc, detectedUrlParams);
    if (bestUrl === originalSrc) {
      toast('이미 최고 화질 상태입니다');
      return;
    }
    // 비교를 위해 현재 상태 저장
    previousImageData = currentImageData ? { ...currentImageData, src: currentSrc } : null;
    pendingCompare = true;
    port.postMessage({ action: 'refetchImage', src: bestUrl });
    toast('최고 화질 URL로 분석 중...');
  }
  if (action === 'param-apply') {
    const newUrl = buildModifiedUrl(originalSrc, detectedUrlParams);
    if (newUrl === originalSrc) {
      toast('변경된 값이 없습니다');
      return;
    }
    // 비교를 위해 현재 상태 저장
    previousImageData = currentImageData ? { ...currentImageData, src: currentSrc } : null;
    pendingCompare = true;
    port.postMessage({ action: 'refetchImage', src: newUrl });
    toast('수정된 URL로 다시 분석 중...');
  }
  if (action === 'param-revert') {
    if (currentSrc === originalSrc) {
      toast('이미 원본 상태입니다');
      return;
    }
    previousImageData = null;
    pendingCompare = false;
    for (const p of detectedUrlParams) p.value = p.originalValue;
    port.postMessage({ action: 'refetchImage', src: originalSrc });
    toast('원본 URL로 다시 분석 중...');
  }
  if (action === 'compare-keep') {
    // 새 이미지 유지 — 비교 배너만 제거
    previousImageData = null;
    pendingCompare = false;
    const banner = document.querySelector('.compare-banner');
    if (banner) banner.remove();
    toast('새 이미지를 유지합니다');
  }
  if (action === 'compare-revert') {
    // 이전 이미지로 되돌리기
    const prevSrc = previousImageData?.src;
    previousImageData = null;
    pendingCompare = false;
    if (prevSrc) {
      port.postMessage({ action: 'refetchImage', src: prevSrc });
      toast('이전 이미지로 되돌리는 중...');
    }
  }
});

$('#btnVideoDownload').addEventListener('click', () => {
  if (!currentVideoData) return;
  chrome.runtime.sendMessage({ action: 'startVideoDownload', videoData: currentVideoData });
});

$('#btnVideoCurl').addEventListener('click', () => {
  const curl = generateVideoCurl();
  if (!curl) {
    toast('cURL 생성 불가 (Blob URL)');
    return;
  }
  navigator.clipboard.writeText(curl).then(() => toast('cURL이 복사되었습니다'));
});

$('#btnVideoCopyUrl').addEventListener('click', () => {
  const url = currentVideoData?.streamUrl || currentVideoData?.src;
  if (!url) return;
  navigator.clipboard.writeText(url).then(() => toast('URL이 복사되었습니다'));
});

$('#historyClear').addEventListener('click', () => {
  imageHistory.length = 0;
  renderHistory();
});

// ── Settings Panel ──

$('#btnSettings').addEventListener('click', () => {
  $('#settingsOverlay').classList.remove('hidden');
});

$('#btnSettingsClose').addEventListener('click', () => {
  $('#settingsOverlay').classList.add('hidden');
});

$('#settingsOverlay').addEventListener('click', (e) => {
  if (e.target === $('#settingsOverlay')) {
    $('#settingsOverlay').classList.add('hidden');
  }
});

$('#autoSaveToggle').addEventListener('change', (e) => {
  settings.autoSave = e.target.checked;
  saveSettings();
});

$('#historyToggle').addEventListener('change', (e) => {
  settings.enableHistory = e.target.checked;
  saveSettings();
  renderHistory();
});

$('#filePrefix').addEventListener('input', (e) => {
  settings.filePrefix = e.target.value;
  saveSettings();
});

$('#saveFormat').addEventListener('change', (e) => {
  settings.saveFormat = e.target.value;
  saveSettings();
});

// ── cURL Generator ──

function generateCurl() {
  const url = currentSrc;
  const parts = [`curl '${escShell(url)}'`];

  // Accept header for images
  parts.push(`  -H 'accept: image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'`);

  // Referer from page URL
  if (currentImageData && currentImageData.pageUrl) {
    parts.push(`  -H 'referer: ${escShell(currentImageData.pageUrl)}'`);
  }

  // User-Agent
  parts.push(`  -H 'user-agent: ${escShell(navigator.userAgent)}'`);

  return parts.join(' \\\n');
}

function escShell(str) {
  // Escape single quotes for use inside single-quoted shell strings
  return str.replace(/'/g, "'\\''");
}

// ── Access & Auth Analysis ──

function analyzeAccess(url, headers, credentialMode, status, cookieInfo, urlAuthParams) {
  const items = [];
  try {
    const u = new URL(url);
    const params = u.searchParams;
    const lowerHeaders = {};
    for (const [k, v] of Object.entries(headers)) lowerHeaders[k.toLowerCase()] = v;

    // 1) Signed URL detection — provider-specific params (unique prefixes)
    const providerParams = {
      'X-Amz-Signature': 'AWS Signature V4',
      'X-Amz-Credential': 'AWS Credential',
      'X-Amz-Date': 'AWS 서명 일시',
      'X-Amz-Expires': 'AWS 만료 시간',
      'X-Amz-Security-Token': 'AWS 임시 토큰',
      'X-Amz-Algorithm': 'AWS 알고리즘',
      'X-Goog-Signature': 'GCP Signature',
      'X-Goog-Credential': 'GCP Credential',
      'X-Goog-Date': 'GCP 서명 일시',
      'X-Goog-Expires': 'GCP 만료 시간',
    };

    // Azure SAS: only when sig + sv + (se or sp) are ALL present
    const azureKeys = ['sig', 'sv', 'se', 'sp', 'ss', 'srt', 'st', 'spr'];
    const azureFound = azureKeys.filter(k => params.has(k));
    const isAzure = azureFound.includes('sig') && azureFound.includes('sv') && azureFound.length >= 3;

    const foundSigned = [];
    for (const [paramKey, label] of Object.entries(providerParams)) {
      for (const [actualKey, actualVal] of params.entries()) {
        if (actualKey.toLowerCase() === paramKey.toLowerCase() && actualVal) {
          foundSigned.push({ key: actualKey, label, value: actualVal });
        }
      }
    }
    if (isAzure) {
      for (const k of azureFound) {
        const val = params.get(k);
        if (val) foundSigned.push({ key: k, label: `Azure ${k}`, value: val });
      }
    }

    // Generic auth params — shown individually, not as "Signed URL"
    const genericAuthParams = {
      'signature': '서명 값',
      'token': '액세스 토큰',
      'auth': '인증 파라미터',
      'api_key': 'API 키',
      'apikey': 'API 키',
      'access_token': '액세스 토큰',
    };
    const foundGeneric = [];
    for (const [paramKey, label] of Object.entries(genericAuthParams)) {
      for (const [actualKey, actualVal] of params.entries()) {
        if (actualKey.toLowerCase() === paramKey.toLowerCase() && actualVal) {
          foundGeneric.push({ key: actualKey, label, value: actualVal });
        }
      }
    }

    if (foundSigned.length > 0) {
      const hasAws = foundSigned.some(s => s.key.toLowerCase().startsWith('x-amz'));
      const hasGcp = foundSigned.some(s => s.key.toLowerCase().startsWith('x-goog'));

      let provider = 'Signed URL';
      if (hasAws) provider = 'AWS S3 Signed URL';
      else if (hasGcp) provider = 'GCP Signed URL';
      else if (isAzure) provider = 'Azure SAS URL';

      items.push({ icon: '🔐', label: provider, desc: `서명 파라미터 ${foundSigned.length}개 감지`, level: 'warn' });

      // Expiration check
      const expiresParam = foundSigned.find(s =>
        ['x-amz-expires', 'x-goog-expires'].includes(s.key.toLowerCase())
      );
      const azureExpires = isAzure ? params.get('se') : null;

      if (expiresParam) {
        const secs = parseInt(expiresParam.value);
        if (secs) items.push({ icon: '⏳', label: '유효 기간', desc: formatDuration(secs * 1000), level: 'info' });
      } else if (azureExpires) {
        const expDate = new Date(azureExpires);
        const remaining = expDate - Date.now();
        if (remaining > 0) {
          items.push({ icon: '⏳', label: '만료 시간', desc: formatDuration(remaining), level: 'info' });
        } else {
          items.push({ icon: '⛔', label: '만료됨', desc: '서명 URL이 만료되었습니다', level: 'error' });
        }
      }

      // Show each signed param
      for (const s of foundSigned) {
        const masked = s.value.length > 20 ? s.value.substring(0, 10) + '···' + s.value.slice(-6) : s.value;
        items.push({ icon: '🔑', label: s.key, desc: masked, level: 'detail' });
      }
    }

    // Generic auth params (not provider-specific)
    if (foundGeneric.length > 0 && foundSigned.length === 0) {
      items.push({ icon: '🔐', label: 'Signed URL', desc: `인증 파라미터 ${foundGeneric.length}개 감지`, level: 'warn' });
      for (const s of foundGeneric) {
        const masked = s.value.length > 20 ? s.value.substring(0, 10) + '···' + s.value.slice(-6) : s.value;
        items.push({ icon: '🔑', label: `${s.label} (${s.key})`, desc: masked, level: 'detail' });
      }
    }

    // 2) Access requirement
    const ci = cookieInfo || {};
    const urlAP = urlAuthParams || [];
    if (credentialMode === 'signed+cookie') {
      items.push({ icon: '🔒', label: '인증 필요', desc: 'URL 서명 + 쿠키 모두 필요', level: 'error' });
      if (urlAP.length) items.push({ icon: '🔑', label: 'URL 인증', desc: urlAP.join(', '), level: 'detail' });
      if (ci.authCookies?.length) items.push({ icon: '🍪', label: '인증 쿠키', desc: ci.authCookies.join(', '), level: 'detail' });
    } else if (credentialMode === 'signed') {
      items.push({ icon: '🔑', label: 'Signed URL', desc: 'URL에 인증 정보 포함 (공유 시 노출 주의)', level: 'warn' });
      if (urlAP.length) items.push({ icon: '🔐', label: '인증 파라미터', desc: urlAP.join(', '), level: 'detail' });
    } else if (credentialMode === 'cookie') {
      items.push({ icon: '🍪', label: '쿠키 필요', desc: '로그인 세션 쿠키 없이 접근 불가', level: 'warn' });
      if (ci.authCookies?.length) items.push({ icon: '🔐', label: '인증 쿠키', desc: ci.authCookies.join(', '), level: 'detail' });
    } else {
      items.push({ icon: '🌐', label: '공개 접근', desc: '인증 없이 접근 가능', level: 'ok' });
    }

    // 3) CORS headers
    const acao = lowerHeaders['access-control-allow-origin'];
    if (acao) {
      if (acao === '*') {
        items.push({ icon: '🔓', label: 'CORS 허용', desc: '모든 출처 허용 (*)', level: 'ok' });
      } else {
        items.push({ icon: '🔒', label: 'CORS 제한', desc: `허용: ${acao}`, level: 'warn' });
      }
    }

    const acac = lowerHeaders['access-control-allow-credentials'];
    if (acac === 'true') {
      items.push({ icon: '🍪', label: 'CORS 인증 허용', desc: '자격 증명 포함 요청 허용', level: 'info' });
    }

    // 4) Cache / CDN headers
    const cacheControl = lowerHeaders['cache-control'];
    if (cacheControl) {
      const isPrivate = cacheControl.includes('private');
      const isNoStore = cacheControl.includes('no-store');
      const isNoCache = cacheControl.includes('no-cache');
      if (isNoStore) {
        items.push({ icon: '🚫', label: '캐시 불가', desc: 'no-store — 저장 금지', level: 'warn' });
      } else if (isPrivate) {
        items.push({ icon: '🔒', label: '프라이빗 캐시', desc: '브라우저에서만 캐시 가능', level: 'info' });
      } else if (isNoCache) {
        items.push({ icon: '⚠️', label: '재검증 필요', desc: '매번 서버 확인 필요', level: 'info' });
      }
      // Max-age
      const maxAge = cacheControl.match(/max-age=(\d+)/);
      if (maxAge) {
        items.push({ icon: '⏱️', label: '캐시 유효', desc: formatDuration(parseInt(maxAge[1]) * 1000), level: 'detail' });
      }
    }

    // 5) CDN identification
    const cdnHeaders = {
      'x-amz-cf-id': 'Amazon CloudFront',
      'x-amz-cf-pop': 'Amazon CloudFront',
      'cf-ray': 'Cloudflare',
      'cf-cache-status': 'Cloudflare',
      'x-fastly-request-id': 'Fastly',
      'x-served-by': 'Fastly / Varnish',
      'x-cache': null, // generic
      'x-cdn': null,
      'server': null,
      'via': null,
    };
    const detectedCdns = new Set();
    for (const [hdr, name] of Object.entries(cdnHeaders)) {
      const val = lowerHeaders[hdr];
      if (!val) continue;
      if (name) { detectedCdns.add(name); continue; }
      // Generic detection from value
      const lv = val.toLowerCase();
      if (lv.includes('cloudfront')) detectedCdns.add('Amazon CloudFront');
      else if (lv.includes('cloudflare')) detectedCdns.add('Cloudflare');
      else if (lv.includes('fastly')) detectedCdns.add('Fastly');
      else if (lv.includes('akamai')) detectedCdns.add('Akamai');
      else if (lv.includes('varnish')) detectedCdns.add('Varnish');
      else if (lv.includes('nginx')) detectedCdns.add('Nginx');
      else if (lv.includes('keycdn')) detectedCdns.add('KeyCDN');
    }
    for (const cdn of detectedCdns) {
      items.push({ icon: '🌍', label: 'CDN', desc: cdn, level: 'info' });
    }

    // 6) Content protection headers
    const contentDisp = lowerHeaders['content-disposition'];
    if (contentDisp) {
      if (contentDisp.includes('attachment')) {
        items.push({ icon: '📎', label: '다운로드 강제', desc: 'Content-Disposition: attachment', level: 'info' });
      }
    }

    // 7) If no auth at all
    if (foundSigned.length === 0 && foundGeneric.length === 0 && credentialMode === 'none' && !acao) {
      items.push({ icon: '✅', label: '직접 접근', desc: '인증 없이 URL로 직접 접근 가능', level: 'ok' });
    }

  } catch {}
  return items;
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 ${s % 60}초`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 ${m % 60}분`;
  const d = Math.floor(h / 24);
  return `${d}일 ${h % 24}시간`;
}

// ── URL Parameter Analysis ──

function analyzeImageUrl(url) {
  if (!url || url.startsWith('data:')) return [];
  const detected = [];

  try {
    const u = new URL(url);
    const path = u.pathname;

    // 1) Query parameters
    const qPatterns = [
      { re: /^(w|width|iw|imageWidth|img_w|W)$/, type: 'width', label: '너비', unit: 'px' },
      { re: /^(h|height|ih|imageHeight|img_h|H)$/, type: 'height', label: '높이', unit: 'px' },
      { re: /^(q|quality|Q|qlty)$/, type: 'quality', label: '품질', unit: '', max: 100 },
      { re: /^(s|size)$/, type: 'size', label: '크기', unit: 'px' },
      { re: /^(dpr|pixel_ratio)$/, type: 'dpr', label: 'DPR', unit: 'x' },
      { re: /^(f|fm|format|output|ext|auto)$/, type: 'format', label: '포맷', preset: ['auto','webp','avif','jpg','png','gif'] },
      { re: /^(name)$/, type: 'preset', label: '프리셋', preset: ['small','medium','large','orig','4096x4096'] },
      { re: /^(crop|fit|resize|mode)$/, type: 'fit', label: '맞춤', preset: ['cover','contain','fill','crop','scale-down'] },
    ];

    for (const [key, value] of u.searchParams) {
      for (const p of qPatterns) {
        if (p.re.test(key)) {
          detected.push({
            type: p.type, label: p.label, key, value: p.preset ? value : Number(value) || value,
            source: 'query', unit: p.unit || '', max: p.max, presets: p.preset || null,
          });
          break;
        }
      }
    }

    // 2) Cloudinary: /c_fill,w_800,h_600,q_80/
    const cloudRe = /\/((?:[a-z]{1,2}_[^/,]+,?\s*){2,})\//i;
    const cloudMatch = path.match(cloudRe);
    if (cloudMatch) {
      for (const t of cloudMatch[1].split(',')) {
        const parts = t.trim().split('_');
        const k = parts[0], v = parts.slice(1).join('_');
        if (k === 'w' && /^\d+$/.test(v)) detected.push({ type: 'width', label: '너비', key: 'w', value: parseInt(v), source: 'cloudinary', unit: 'px' });
        if (k === 'h' && /^\d+$/.test(v)) detected.push({ type: 'height', label: '높이', key: 'h', value: parseInt(v), source: 'cloudinary', unit: 'px' });
        if (k === 'q' && /^\d+$/.test(v)) detected.push({ type: 'quality', label: '품질', key: 'q', value: parseInt(v), source: 'cloudinary', unit: '', max: 100 });
        if (k === 'f') detected.push({ type: 'format', label: '포맷', key: 'f', value: v, source: 'cloudinary', presets: ['auto','webp','avif','jpg','png'] });
      }
    }

    // 3) Google/YouTube: =s800 =w800 =w800-h600 =s0 (original)
    // Only match on Google domains to avoid false positives
    const isGoogle = /\.(google|gstatic|ggpht|googleusercontent|ytimg)\./.test(u.hostname);
    if (isGoogle) {
      const googleMatch = url.match(/=([swh]\d+(?:-[swh]\d+(?:-[a-z]*)?)*)$/);
      if (googleMatch) {
        for (const p of googleMatch[1].split('-')) {
          if (/^s\d+$/i.test(p)) detected.push({ type: 'size', label: '크기', key: 's', value: parseInt(p.slice(1)), source: 'google', unit: 'px', hint: '0 = 원본' });
          if (/^w\d+$/i.test(p)) detected.push({ type: 'width', label: '너비', key: 'w', value: parseInt(p.slice(1)), source: 'google', unit: 'px' });
          if (/^h\d+$/i.test(p)) detected.push({ type: 'height', label: '높이', key: 'h', value: parseInt(p.slice(1)), source: 'google', unit: 'px' });
        }
      }
    }

    // 4) Naver (pstatic.net, naver.net 등)
    //    Query: ?type=w966 ?type=w80_blur ?type=w2
    //    Path:  /type/w800 /type/w800_2
    const isNaver = /\.(pstatic\.net|naver\.net|naver\.com)/.test(u.hostname);
    const naverTypeParam = u.searchParams.get('type');
    if (naverTypeParam) {
      const naverQMatch = naverTypeParam.match(/^([wh])(\d+)/);
      if (naverQMatch) {
        const t = naverQMatch[1] === 'w' ? 'width' : 'height';
        detected.push({
          type: t, label: t === 'width' ? '너비' : '높이',
          key: 'type', value: parseInt(naverQMatch[2]),
          source: 'naver_query', unit: 'px',
          rawTypeValue: naverTypeParam, // e.g. 'w966' or 'w80_blur'
          dimChar: naverQMatch[1],      // 'w' or 'h'
        });
      }
    }
    if (!detected.find(p => p.source === 'naver_query')) {
      const naverPathMatch = path.match(/\/type\/([wh])(\d+)/);
      if (naverPathMatch) {
        const t = naverPathMatch[1] === 'w' ? 'width' : 'height';
        detected.push({ type: t, label: t === 'width' ? '너비' : '높이', key: naverPathMatch[1], value: parseInt(naverPathMatch[2]), source: 'naver_path', unit: 'px' });
      }
    }

    // 5) Dimension in path: /800x600/ or /resize/800x600/
    if (!detected.find(p => p.type === 'width')) {
      const dimMatch = path.match(/\/(\d{2,5})x(\d{2,5})(\/|$)/);
      if (dimMatch) {
        detected.push({ type: 'width', label: '너비', key: null, value: parseInt(dimMatch[1]), source: 'path_dim', unit: 'px', origDim: dimMatch[0] });
        detected.push({ type: 'height', label: '높이', key: null, value: parseInt(dimMatch[2]), source: 'path_dim', unit: 'px', origDim: dimMatch[0] });
      }
    }

    // 6) WordPress: filename-800x600.jpg
    if (!detected.find(p => p.type === 'width')) {
      const wpMatch = path.match(/-(\d{2,5})x(\d{2,5})\.(jpe?g|png|gif|webp)/i);
      if (wpMatch) {
        detected.push({ type: 'width', label: '너비', key: null, value: parseInt(wpMatch[1]), source: 'wordpress', unit: 'px' });
        detected.push({ type: 'height', label: '높이', key: null, value: parseInt(wpMatch[2]), source: 'wordpress', unit: 'px' });
      }
    }

    // 7) Shopify: _800x600.jpg or _800x.jpg
    if (!detected.find(p => p.type === 'width')) {
      const shopMatch = path.match(/_(\d{2,5})x(\d{0,5})\.(jpe?g|png|gif|webp)/i);
      if (shopMatch) {
        detected.push({ type: 'width', label: '너비', key: null, value: parseInt(shopMatch[1]), source: 'shopify', unit: 'px' });
        if (shopMatch[2]) detected.push({ type: 'height', label: '높이', key: null, value: parseInt(shopMatch[2]), source: 'shopify', unit: 'px' });
      }
    }

  } catch {}

  // Tag each param with its original value for revert
  for (const p of detected) p.originalValue = p.value;
  return detected;
}

function buildModifiedUrl(originalUrl, params) {
  let url = originalUrl;
  try {
    const u = new URL(url);

    for (const p of params) {
      if (p.value === p.originalValue) continue;

      switch (p.source) {
        case 'query':
          u.searchParams.set(p.key, String(p.value));
          break;
        case 'cloudinary':
          u.pathname = u.pathname.replace(`${p.key}_${p.originalValue}`, `${p.key}_${p.value}`);
          break;
        case 'google':
          url = url.replace(`${p.key}${p.originalValue}`, `${p.key}${p.value}`);
          return url;
        case 'naver_path':
          u.pathname = u.pathname.replace(`/${p.key}${p.originalValue}`, `/${p.key}${p.value}`);
          break;
        case 'path_dim': {
          const wp = params.find(x => x.type === 'width' && x.source === 'path_dim');
          const hp = params.find(x => x.type === 'height' && x.source === 'path_dim');
          if (wp && hp) {
            u.pathname = u.pathname.replace(
              `/${wp.originalValue}x${hp.originalValue}`,
              `/${wp.value}x${hp.value}`
            );
          }
          break;
        }
        case 'wordpress': {
          const wp = params.find(x => x.type === 'width' && x.source === 'wordpress');
          const hp = params.find(x => x.type === 'height' && x.source === 'wordpress');
          if (wp && hp) {
            u.pathname = u.pathname.replace(
              `-${wp.originalValue}x${hp.originalValue}.`,
              `-${wp.value}x${hp.value}.`
            );
          }
          break;
        }
        case 'shopify': {
          const wp = params.find(x => x.type === 'width' && x.source === 'shopify');
          const hp = params.find(x => x.type === 'height' && x.source === 'shopify');
          const oldSuffix = `_${wp?.originalValue}x${hp?.originalValue || ''}`;
          const newSuffix = `_${wp?.value}x${hp?.value || ''}`;
          u.pathname = u.pathname.replace(oldSuffix + '.', newSuffix + '.');
          break;
        }
        case 'naver_query': {
          const oldType = p.rawTypeValue;
          const newType = oldType.replace(/([wh])\d+/, `$1${p.value}`);
          u.searchParams.set('type', newType);
          break;
        }
      }
    }
    url = u.toString();
  } catch {}
  return url;
}

function buildBestQualityUrl(url, params) {
  try {
    const u = new URL(url);

    // Track which source types we've handled (avoid double-processing)
    const handled = new Set();

    for (const p of params) {
      if (handled.has(p.source + ':' + p.type)) continue;

      switch (p.source) {
        case 'query':
          if (['width', 'height', 'size'].includes(p.type)) {
            u.searchParams.delete(p.key);
          } else if (p.type === 'quality') {
            u.searchParams.set(p.key, String(p.max || 100));
          } else if (p.type === 'dpr') {
            u.searchParams.delete(p.key);
          } else if (p.type === 'preset') {
            u.searchParams.set(p.key, 'orig');
          } else if (p.type === 'format') {
            u.searchParams.delete(p.key);
          }
          break;

        case 'cloudinary': {
          // Parse cloudinary transform segment and rebuild
          const cloudRe = /\/((?:[a-z]{1,2}_[^/,]+,?\s*){2,})\//i;
          const m = u.pathname.match(cloudRe);
          if (m) {
            const transforms = m[1].split(',').map(t => t.trim());
            const filtered = transforms
              .filter(t => !/^[wh]_\d+$/.test(t))   // Remove w_N, h_N
              .map(t => /^q_\d+$/.test(t) ? 'q_100' : t); // Quality → 100
            u.pathname = u.pathname.replace(m[1], filtered.join(','));
          }
          handled.add('cloudinary:width');
          handled.add('cloudinary:height');
          handled.add('cloudinary:quality');
          break;
        }

        case 'google':
          // =s0 means original size in Google
          url = url.replace(/=[swh]\d+(?:-[swh]\d+(?:-[a-z]*)?)*$/, '=s0');
          return url;

        case 'naver_path':
          // Remove /type/wN or set to very large
          u.pathname = u.pathname.replace(/\/type\/[wh]\d+(_\d+)?/, '');
          handled.add('naver_path:width');
          handled.add('naver_path:height');
          break;

        case 'wordpress': {
          // image-800x600.jpg → image.jpg (original)
          const wp = params.find(x => x.type === 'width' && x.source === 'wordpress');
          const hp = params.find(x => x.type === 'height' && x.source === 'wordpress');
          if (wp && hp) {
            u.pathname = u.pathname.replace(`-${wp.originalValue}x${hp.originalValue}`, '');
          }
          handled.add('wordpress:width');
          handled.add('wordpress:height');
          break;
        }

        case 'shopify': {
          const ws = params.find(x => x.type === 'width' && x.source === 'shopify');
          const hs = params.find(x => x.type === 'height' && x.source === 'shopify');
          const old = `_${ws?.originalValue}x${hs?.originalValue || ''}`;
          u.pathname = u.pathname.replace(old + '.', '.');
          handled.add('shopify:width');
          handled.add('shopify:height');
          break;
        }

        case 'path_dim': {
          // Try removing or doubling
          const wd = params.find(x => x.type === 'width' && x.source === 'path_dim');
          const hd = params.find(x => x.type === 'height' && x.source === 'path_dim');
          if (wd && hd) {
            u.pathname = u.pathname.replace(
              `/${wd.originalValue}x${hd.originalValue}`,
              `/${wd.originalValue * 4}x${hd.originalValue * 4}`
            );
          }
          handled.add('path_dim:width');
          handled.add('path_dim:height');
          break;
        }

        case 'naver_query': {
          // Naver: removing ?type= makes quality worse
          // Instead, maximize width to w9999 (server will cap at original)
          const nqp = params.find(x => x.source === 'naver_query');
          if (nqp) {
            const currentType = u.searchParams.get('type') || '';
            const newType = currentType.replace(/([wh])\d+/, '$19999');
            u.searchParams.set('type', newType);
          }
          handled.add('naver_query:width');
          handled.add('naver_query:height');
          break;
        }
      }
      handled.add(p.source + ':' + p.type);
    }

    return u.toString();
  } catch {
    return url;
  }
}

function renderUrlParams(params, container) {
  if (params.length === 0) return;

  const section = document.createElement('div');
  section.className = 'info-section url-params-section';

  const header = document.createElement('div');
  header.className = 'info-section-header';
  header.innerHTML = `URL 파라미터 <span class="param-count">${params.length}개 감지</span>`;
  header.addEventListener('click', (e) => {
    e.stopPropagation();
    section.classList.toggle('collapsed');
  });

  const body = document.createElement('div');
  body.className = 'info-section-body url-params-body';

  // CDN badge
  const cdnName = detectCdnName(params);
  if (cdnName) {
    const badge = document.createElement('div');
    badge.className = 'cdn-badge';
    badge.textContent = cdnName;
    body.appendChild(badge);
  }

  // Param rows
  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    const row = document.createElement('div');
    row.className = 'param-row';

    const label = document.createElement('span');
    label.className = 'info-label';
    label.textContent = p.label;

    const control = document.createElement('div');
    control.className = 'param-control';

    if (p.presets) {
      const select = document.createElement('select');
      select.className = 'param-select';
      for (const opt of p.presets) {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        if (opt === String(p.value)) o.selected = true;
        select.appendChild(o);
      }
      // Add current value if not in presets
      if (!p.presets.includes(String(p.value))) {
        const o = document.createElement('option');
        o.value = p.value;
        o.textContent = `${p.value} (현재)`;
        o.selected = true;
        select.prepend(o);
      }
      select.addEventListener('change', () => {
        p.value = select.value;
        onParamChanged();
      });
      control.appendChild(select);
    } else {
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'param-input';
      input.value = p.value;
      input.min = p.type === 'quality' ? 1 : 1;
      if (p.max) input.max = p.max;

      const unit = document.createElement('span');
      unit.className = 'param-unit';
      unit.textContent = p.unit || '';

      input.addEventListener('input', () => {
        p.value = Number(input.value) || p.originalValue;
        onParamChanged();
      });

      control.appendChild(input);
      if (p.unit) control.appendChild(unit);

      // Quick multiplier buttons for width/height/size
      if (['width', 'height', 'size'].includes(p.type)) {
        const multipliers = document.createElement('div');
        multipliers.className = 'param-multipliers';
        for (const m of ['0.5x', '2x', 'MAX']) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'param-mult-btn';
          btn.textContent = m;
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (m === 'MAX') input.value = p.type === 'quality' ? 100 : (p.originalValue * 4);
            else input.value = Math.round(p.originalValue * parseFloat(m));
            p.value = Number(input.value);
            onParamChanged();
          });
          multipliers.appendChild(btn);
        }
        control.appendChild(multipliers);
      }

      // Slider for quality
      if (p.type === 'quality') {
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'param-slider';
        slider.min = 1;
        slider.max = p.max || 100;
        slider.value = p.value;
        slider.addEventListener('input', () => {
          input.value = slider.value;
          p.value = Number(slider.value);
          onParamChanged();
        });
        input.addEventListener('input', () => { slider.value = input.value; });
        control.appendChild(slider);
      }
    }

    if (p.hint) {
      const hint = document.createElement('span');
      hint.className = 'param-hint';
      hint.textContent = p.hint;
      control.appendChild(hint);
    }

    row.appendChild(label);
    row.appendChild(control);
    body.appendChild(row);
  }

  // Preview + Actions
  const actions = document.createElement('div');
  actions.className = 'param-actions';

  const previewWrap = document.createElement('div');
  previewWrap.className = 'param-preview hidden';
  previewWrap.id = 'paramPreview';
  const previewImg = document.createElement('img');
  previewImg.id = 'paramPreviewImg';
  const previewInfo = document.createElement('span');
  previewInfo.className = 'param-preview-info';
  previewInfo.id = 'paramPreviewInfo';
  previewWrap.appendChild(previewImg);
  previewWrap.appendChild(previewInfo);

  const btnBest = document.createElement('button');
  btnBest.type = 'button';
  btnBest.className = 'action-btn best-quality-btn';
  btnBest.textContent = '최고 화질';
  btnBest.setAttribute('data-action', 'param-best');

  const btnApply = document.createElement('button');
  btnApply.type = 'button';
  btnApply.className = 'action-btn primary param-apply';
  btnApply.textContent = '적용';
  btnApply.setAttribute('data-action', 'param-apply');

  const btnRevert = document.createElement('button');
  btnRevert.type = 'button';
  btnRevert.className = 'action-btn param-revert';
  btnRevert.textContent = '원본';
  btnRevert.setAttribute('data-action', 'param-revert');

  actions.appendChild(btnBest);
  actions.appendChild(btnApply);
  actions.appendChild(btnRevert);

  body.appendChild(previewWrap);
  body.appendChild(actions);

  section.appendChild(header);
  section.appendChild(body);
  container.appendChild(section);
}

function onParamChanged() {
  const newUrl = buildModifiedUrl(originalSrc, detectedUrlParams);
  const preview = document.getElementById('paramPreview');
  const previewImg = document.getElementById('paramPreviewImg');
  const previewInfo = document.getElementById('paramPreviewInfo');

  if (preview && previewImg) {
    preview.classList.remove('hidden');
    previewImg.src = newUrl;
    previewInfo.textContent = '미리보기 로딩 중...';

    previewImg.onload = () => {
      previewInfo.textContent = `${previewImg.naturalWidth} x ${previewImg.naturalHeight}`;
    };
    previewImg.onerror = () => {
      previewInfo.textContent = '로드 실패 — 해당 값은 지원되지 않을 수 있습니다';
    };
  }
}

function detectCdnName(params) {
  const source = params[0]?.source;
  const names = {
    cloudinary: 'Cloudinary',
    google: 'Google',
    naver_path: 'Naver',
    naver_query: 'Naver',
    wordpress: 'WordPress',
    shopify: 'Shopify',
  };
  return names[source] || null;
}

// ── Utils ──

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatFileSize(bytes) {
  if (!bytes) return 'N/A';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

function formatContentType(ct) {
  const map = {'image/jpeg':'JPEG','image/png':'PNG','image/gif':'GIF','image/webp':'WebP','image/svg+xml':'SVG','image/avif':'AVIF','image/bmp':'BMP','image/tiff':'TIFF'};
  for (const [k,v] of Object.entries(map)) { if (ct && ct.includes(k)) return v; }
  return ct || 'Unknown';
}

function truncateUrl(url) {
  return url;  // CSS handles overflow; full URL preserved for copy
}

function extractFilename(url) {
  try { const n = new URL(url).pathname.split('/').pop(); if (n && n.includes('.')) return decodeURIComponent(n); } catch {}
  return null;
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

// ── Init ──
showState('empty');
loadSettings();
