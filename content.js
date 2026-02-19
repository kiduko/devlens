(() => {
  let active = false;
  let metaDown = false;

  // ── Extension context guard ──
  function isContextValid() {
    try { return !!chrome.runtime?.id; } catch { return false; }
  }

  function safeSendMessage(msg) {
    if (!isContextValid()) { deactivate(); return; }
    try { chrome.runtime.sendMessage(msg); } catch { deactivate(); }
  }

  // ── Stream URL Capture ──
  const capturedStreams = new Map();

  // Network sniffer is now injected via sniffer.js (MAIN world content script in manifest)

  window.addEventListener('message', (e) => {
    if (e.data && e.data.__devlens_stream) {
      const url = e.data.__devlens_stream;
      const type = url.includes('.mpd') ? 'dash' : 'hls';
      capturedStreams.set(url, { type, timestamp: Date.now() });
    }
  });

  // ── Activation ──

  function activate() {
    if (active) return;
    if (!isContextValid()) return;
    active = true;
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('mouseover', onHover, true);
    document.addEventListener('mouseout', onHoverOut, true);
    window.addEventListener('blur', onBlur);
  }

  function deactivate() {
    if (!active) return;
    active = false;
    metaDown = false;
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('keyup', onKeyUp, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('mouseover', onHover, true);
    document.removeEventListener('mouseout', onHoverOut, true);
    window.removeEventListener('blur', onBlur);
    document.querySelectorAll('.devlens-hover').forEach(el => el.classList.remove('devlens-hover'));
  }

  function onKeyDown(e) { if (e.key === 'Meta' || e.key === 'Control') metaDown = true; }
  function onKeyUp(e) {
    if (e.key === 'Meta' || e.key === 'Control') {
      metaDown = false;
      document.querySelectorAll('.devlens-hover').forEach(el => el.classList.remove('devlens-hover'));
    }
  }
  function onBlur() {
    metaDown = false;
    document.querySelectorAll('.devlens-hover').forEach(el => el.classList.remove('devlens-hover'));
  }

  // ── Media detection ──

  function getImageSrc(el) {
    if (!el) return null;
    if (el.tagName === 'IMG' && el.src) return el.src;
    if (el.tagName === 'SOURCE' && el.closest('picture')) {
      const img = el.closest('picture').querySelector('img');
      if (img?.src) return img.src;
    }
    if (el.tagName === 'SVG' || el.tagName === 'CANVAS') return null;
    const bg = getBgImage(el);
    if (bg) return bg;
    const childImg = el.querySelector('img');
    if (childImg?.src) return childImg.src;
    let parent = el.parentElement;
    for (let i = 0; i < 3 && parent; i++, parent = parent.parentElement) {
      if (parent.tagName === 'IMG' && parent.src) return parent.src;
      const pbg = getBgImage(parent);
      if (pbg) return pbg;
      const pImg = parent.querySelector('img');
      if (pImg?.src) return pImg.src;
    }
    return null;
  }

  function getVideoInfo(el) {
    if (!el) return null;
    const video = el.closest('video') || el.querySelector('video');
    if (!video) return null;

    const sources = Array.from(video.querySelectorAll('source'));
    const srcUrl = video.currentSrc || video.src || (sources[0] && sources[0].src) || '';
    const isBlob = srcUrl.startsWith('blob:');

    // Find associated stream URLs
    let streamUrl = null;
    let streamType = null;
    if (isBlob && capturedStreams.size > 0) {
      let latest = null;
      for (const [url, info] of capturedStreams) {
        if (!latest || info.timestamp > latest.timestamp) {
          latest = { url, ...info };
        }
      }
      if (latest) {
        streamUrl = latest.url;
        streamType = latest.type;
      }
    }

    // Capture current frame as thumbnail
    let frameThumbnail = '';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || video.clientWidth || 320;
      canvas.height = video.videoHeight || video.clientHeight || 180;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frameThumbnail = canvas.toDataURL('image/jpeg', 0.8);
    } catch {}

    return {
      type: 'video',
      src: srcUrl,
      isBlob,
      streamUrl,
      streamType,
      poster: video.poster || '',
      frameThumbnail,
      duration: isFinite(video.duration) ? video.duration : 0,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      renderWidth: video.clientWidth,
      renderHeight: video.clientHeight,
      currentTime: video.currentTime,
      paused: video.paused,
    };
  }

  function getBgImage(el) {
    const style = getComputedStyle(el);
    const bg = style.backgroundImage;
    if (!bg || bg === 'none') return null;
    const match = bg.match(/url\(["']?(.+?)["']?\)/);
    if (match && match[1]) {
      const url = match[1];
      if (url.startsWith('data:') && url.length < 200) return null;
      return url;
    }
    return null;
  }

  function isLargeEnough(el) {
    const rect = el.getBoundingClientRect();
    return rect.width >= 30 && rect.height >= 30;
  }

  // ── Events ──

  function onHover(e) {
    if (!metaDown) return;
    if (!isContextValid()) { deactivate(); return; }
    const el = e.target;
    if (el.closest('video') || getImageSrc(el)) {
      if (isLargeEnough(el)) el.classList.add('devlens-hover');
    }
  }

  function onHoverOut(e) {
    e.target.classList.remove('devlens-hover');
  }

  function onClick(e) {
    if (!metaDown) return;
    if (!isContextValid()) { deactivate(); return; }

    // Check video first
    const videoInfo = getVideoInfo(e.target);
    if (videoInfo) {
      e.preventDefault();
      e.stopPropagation();
      safeSendMessage({ action: 'videoSelected', videoInfo });
      return;
    }

    // Then check image
    const img = e.target.closest('img');
    let src = null;
    if (img && isLargeEnough(img)) {
      src = img.src;
    } else {
      src = getImageSrc(e.target);
    }
    if (!src) return;

    e.preventDefault();
    e.stopPropagation();

    const imgEl = e.target.closest('img') || e.target.querySelector('img');
    const pageInfo = {
      renderWidth: imgEl?.clientWidth || e.target.clientWidth,
      renderHeight: imgEl?.clientHeight || e.target.clientHeight,
      naturalWidth: imgEl?.naturalWidth || 0,
      naturalHeight: imgEl?.naturalHeight || 0,
      alt: imgEl?.alt || '',
    };

    safeSendMessage({ action: 'imageSelected', src, pageInfo });
  }

  // ── Messages ──

  if (isContextValid()) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (!isContextValid()) return;
      if (msg.action === 'activateInspector') activate();
      if (msg.action === 'deactivateInspector') deactivate();
    });

    safeSendMessage({ action: 'contentReady' });
  }
})();
