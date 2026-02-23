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
  const capturedStreams = new Map();  // manifest URL → { type, timestamp }
  const msBlobUrls = new Set();      // blob URLs backed by MediaSource
  const segmentBases = new Map();    // segment base URL → { count, lastSeen }
  const directMedia = [];            // direct video/audio URLs (YouTube etc.)
  let captureInfo = null;            // MSE buffer capture status
  const captureInfoMap = new Map();  // blobUrl → captureInfo

  window.addEventListener('message', (e) => {
    if (!e.data) return;
    if (e.data.__devlens_stream) {
      const url = e.data.__devlens_stream;
      const type = e.data.__devlens_type || (url.includes('.mpd') ? 'dash' : 'hls');
      capturedStreams.set(url, { type, timestamp: Date.now() });
    }
    if (e.data.__devlens_msblob) {
      msBlobUrls.add(e.data.__devlens_msblob);
    }
    if (e.data.__devlens_segment) {
      const segUrl = e.data.__devlens_segment;
      try {
        const base = segUrl.substring(0, segUrl.lastIndexOf('/') + 1);
        const prev = segmentBases.get(base) || { count: 0, lastSeen: 0 };
        segmentBases.set(base, { count: prev.count + 1, lastSeen: Date.now() });
      } catch {}
    }
    if (e.data.__devlens_direct_media) {
      const info = e.data.__devlens_media_info || {};
      const exists = directMedia.find(m => m.url === e.data.__devlens_direct_media);
      if (!exists) {
        directMedia.push({ url: e.data.__devlens_direct_media, ...info, timestamp: Date.now() });
      }
    }
    if (e.data.__devlens_capture) {
      captureInfo = e.data.__devlens_capture;
      if (e.data.__devlens_capture.blobUrl) {
        captureInfoMap.set(e.data.__devlens_capture.blobUrl, e.data.__devlens_capture);
      }
    }
    if (e.data.__devlens_capture_done) {
      safeSendMessage({ action: 'captureDownloadDone', size: e.data.size });
    }
    if (e.data.__devlens_capture_error) {
      safeSendMessage({ action: 'captureDownloadError', error: e.data.__devlens_capture_error });
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
    let video = el.closest('video') || el.querySelector('video');
    // Search up the DOM tree (limited to avoid finding wrong video)
    if (!video) {
      let parent = el.parentElement;
      for (let i = 0; i < 5 && parent; i++, parent = parent.parentElement) {
        video = parent.querySelector('video');
        if (video) break;
      }
    }
    if (!video) return null;

    const sources = Array.from(video.querySelectorAll('source'));
    const srcUrl = video.currentSrc || video.src || (sources[0] && sources[0].src) || '';
    const isBlob = srcUrl.startsWith('blob:');

    // Find associated stream URLs
    let streamUrl = null;
    let streamType = null;
    const isMsBlob = isBlob && msBlobUrls.has(srcUrl);

    if (capturedStreams.size > 0) {
      // Find the most recent captured stream URL
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

    // If no manifest found but segments detected, try to derive manifest URL
    if (!streamUrl && segmentBases.size > 0) {
      let bestBase = null;
      for (const [base, info] of segmentBases) {
        if (info.count >= 2 && (!bestBase || info.lastSeen > bestBase.lastSeen)) {
          bestBase = { base, ...info };
        }
      }
      if (bestBase) {
        // Common manifest filenames relative to segment base
        const candidates = ['index.m3u8', 'master.m3u8', 'playlist.m3u8', 'manifest.m3u8', 'stream.m3u8'];
        // Store base for background to try
        streamUrl = bestBase.base;
        streamType = 'hls_base';
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

    // Get capture info for this specific video's blob URL
    const videoCaptureInfo = (isBlob && captureInfoMap.has(srcUrl))
      ? captureInfoMap.get(srcUrl)
      : captureInfo;

    return {
      type: 'video',
      src: srcUrl,
      isBlob,
      isMsBlob,
      captureInfo: videoCaptureInfo,
      directMedia: directMedia.length > 0 ? [...directMedia] : null,
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

  // ── Instagram username extraction ──

  function findIgUsername(el) {
    const reserved = new Set(['explore', 'reels', 'reel', 'direct', 'accounts', 'p', 'stories', 'about', 'nametag', 'static', 'legal', 'api', 'developer', 'graphql']);

    // 1. From page URL: /username/reel/... or /stories/username/...
    try {
      const parts = location.pathname.split('/').filter(Boolean);
      if (parts.length >= 1) {
        if (parts[0] === 'stories' && parts[1]) return parts[1];
        if (!reserved.has(parts[0])) return parts[0];
      }
    } catch {}

    // 2. From article container (Instagram wraps posts in <article>)
    try {
      const article = el.closest('article') || el.closest('[role="presentation"]');
      if (article) {
        const links = article.querySelectorAll('a[href^="/"]');
        for (const a of links) {
          const href = a.getAttribute('href');
          const m = href.match(/^\/([a-zA-Z0-9._]{1,30})\/?$/);
          if (m && !reserved.has(m[1])) return m[1];
        }
      }
    } catch {}

    // 3. Broader search: go up from element looking for profile links
    try {
      let container = el;
      for (let i = 0; i < 15 && container; i++, container = container.parentElement) {
        const links = container.querySelectorAll('a[href^="/"]');
        for (const a of links) {
          const href = a.getAttribute('href');
          const m = href.match(/^\/([a-zA-Z0-9._]{1,30})\/?$/);
          if (m && !reserved.has(m[1])) return m[1];
        }
        if (container.tagName === 'ARTICLE' || container.tagName === 'MAIN') break;
      }
    } catch {}

    return null;
  }

  function findIgShortcode(el) {
    // 1. From page URL: /reel/ABC123/ or /p/ABC123/
    const urlMatch = location.pathname.match(/\/(reel|reels|p)\/([A-Za-z0-9_-]+)/);
    if (urlMatch) return urlMatch[2];

    // 2. From nearby links in the DOM
    let container = el;
    for (let i = 0; i < 10 && container; i++, container = container.parentElement) {
      const links = container.querySelectorAll('a[href*="/reel/"], a[href*="/p/"]');
      for (const a of links) {
        const m = a.getAttribute('href').match(/\/(reel|p)\/([A-Za-z0-9_-]+)/);
        if (m) return m[2];
      }
      if (container.tagName === 'ARTICLE' || container.tagName === 'MAIN') break;
    }
    return null;
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

    // Find the exact video element at click position (prefer playing one)
    let videoTarget = e.target;
    let foundVideo = null;
    const allVideos = document.querySelectorAll('video');
    for (const v of allVideos) {
      const rect = v.getBoundingClientRect();
      if (rect.width < 30 || rect.height < 30) continue;
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom) {
        if (!foundVideo || (!v.paused && foundVideo.paused)) {
          foundVideo = v;
        }
      }
    }
    if (foundVideo) videoTarget = foundVideo;

    const videoInfo = getVideoInfo(videoTarget);
    if (videoInfo) {
      e.preventDefault();
      e.stopPropagation();

      // Instagram: find username and shortcode for API-based download
      if (location.hostname.includes('instagram.com')) {
        videoInfo.igUsername = findIgUsername(e.target);
        videoInfo.igShortcode = findIgShortcode(e.target);
      }

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
      if (msg.action === 'downloadCapture') {
        window.postMessage({ __devlens_download_capture: true, filename: msg.filename || 'video', blobUrl: msg.blobUrl || '' }, '*');
      }
    });

    safeSendMessage({ action: 'contentReady' });
  }
})();
