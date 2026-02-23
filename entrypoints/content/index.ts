import { activateOverlay, deactivateOverlay, handleOverlayResultBatch } from './overlay';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  cssInjectionMode: 'ui',

  main() {
    let active = false;
    let metaDown = false;

    // Inject hover highlight CSS
    const style = document.createElement('style');
    style.textContent = `.devlens-hover { outline: 3px solid #3b82f6 !important; outline-offset: 2px !important; cursor: crosshair !important; }`;
    document.head.appendChild(style);

    // Extension context guard
    function isContextValid(): boolean {
      try { return !!chrome.runtime?.id; } catch { return false; }
    }

    function safeSendMessage(msg: any): void {
      if (!isContextValid()) { deactivate(); return; }
      try { chrome.runtime.sendMessage(msg); } catch { deactivate(); }
    }

    // Stream URL Capture
    const capturedStreams = new Map<string, { type: string; timestamp: number }>();
    const msBlobUrls = new Set<string>();
    const segmentBases = new Map<string, { count: number; lastSeen: number }>();
    const directMedia: any[] = [];
    let captureInfo: any = null;
    const captureInfoMap = new Map<string, any>();

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
        } catch { /* ignore */ }
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

    // Activation
    function activate(): void {
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

    function deactivate(): void {
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

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Meta' || e.key === 'Control') metaDown = true;
    }
    function onKeyUp(e: KeyboardEvent): void {
      if (e.key === 'Meta' || e.key === 'Control') {
        metaDown = false;
        document.querySelectorAll('.devlens-hover').forEach(el => el.classList.remove('devlens-hover'));
      }
    }
    function onBlur(): void {
      metaDown = false;
      document.querySelectorAll('.devlens-hover').forEach(el => el.classList.remove('devlens-hover'));
    }

    // Media detection
    function getImageSrc(el: Element): string | null {
      if (!el) return null;
      if (el.tagName === 'IMG' && (el as HTMLImageElement).src) return (el as HTMLImageElement).src;
      if (el.tagName === 'SOURCE' && el.closest('picture')) {
        const img = el.closest('picture')!.querySelector('img');
        if (img?.src) return img.src;
      }
      if (el.tagName === 'SVG' || el.tagName === 'CANVAS') return null;
      const bg = getBgImage(el);
      if (bg) return bg;
      const childImg = el.querySelector('img');
      if (childImg?.src) return childImg.src;
      let parent = el.parentElement;
      for (let i = 0; i < 3 && parent; i++, parent = parent.parentElement) {
        if (parent.tagName === 'IMG' && (parent as HTMLImageElement).src) return (parent as HTMLImageElement).src;
        const pbg = getBgImage(parent);
        if (pbg) return pbg;
        const pImg = parent.querySelector('img');
        if (pImg?.src) return pImg.src;
      }
      return null;
    }

    function getVideoInfo(el: Element): any {
      if (!el) return null;
      let video = el.closest('video') || el.querySelector('video');
      if (!video) {
        let parent = el.parentElement;
        for (let i = 0; i < 5 && parent; i++, parent = parent.parentElement) {
          video = parent.querySelector('video');
          if (video) break;
        }
      }
      if (!video) return null;

      const videoEl = video as HTMLVideoElement;
      const sources = Array.from(videoEl.querySelectorAll('source'));
      const srcUrl = videoEl.currentSrc || videoEl.src || (sources[0] && (sources[0] as HTMLSourceElement).src) || '';
      const isBlob = srcUrl.startsWith('blob:');

      let streamUrl: string | null = null;
      let streamType: string | null = null;
      const isMsBlob = isBlob && msBlobUrls.has(srcUrl);

      if (capturedStreams.size > 0) {
        let latest: { url: string; type: string; timestamp: number } | null = null;
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

      if (!streamUrl && segmentBases.size > 0) {
        let bestBase: { base: string; count: number; lastSeen: number } | null = null;
        for (const [base, info] of segmentBases) {
          if (info.count >= 2 && (!bestBase || info.lastSeen > bestBase.lastSeen)) {
            bestBase = { base, ...info };
          }
        }
        if (bestBase) {
          streamUrl = bestBase.base;
          streamType = 'hls_base';
        }
      }

      let frameThumbnail = '';
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth || videoEl.clientWidth || 320;
        canvas.height = videoEl.videoHeight || videoEl.clientHeight || 180;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        frameThumbnail = canvas.toDataURL('image/jpeg', 0.8);
      } catch { /* ignore */ }

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
        poster: videoEl.poster || '',
        frameThumbnail,
        duration: isFinite(videoEl.duration) ? videoEl.duration : 0,
        videoWidth: videoEl.videoWidth,
        videoHeight: videoEl.videoHeight,
        renderWidth: videoEl.clientWidth,
        renderHeight: videoEl.clientHeight,
        currentTime: videoEl.currentTime,
        paused: videoEl.paused,
      };
    }

    function getBgImage(el: Element): string | null {
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

    function isLargeEnough(el: Element): boolean {
      const rect = el.getBoundingClientRect();
      return rect.width >= 30 && rect.height >= 30;
    }

    // Instagram helpers
    function findIgUsername(el: Element): string | null {
      const reserved = new Set(['explore', 'reels', 'reel', 'direct', 'accounts', 'p', 'stories', 'about', 'nametag', 'static', 'legal', 'api', 'developer', 'graphql']);

      try {
        const parts = location.pathname.split('/').filter(Boolean);
        if (parts.length >= 1) {
          if (parts[0] === 'stories' && parts[1]) return parts[1];
          if (!reserved.has(parts[0])) return parts[0];
        }
      } catch { /* ignore */ }

      try {
        const article = el.closest('article') || el.closest('[role="presentation"]');
        if (article) {
          const links = article.querySelectorAll('a[href^="/"]');
          for (const a of links) {
            const href = a.getAttribute('href');
            const m = href?.match(/^\/([a-zA-Z0-9._]{1,30})\/?$/);
            if (m && !reserved.has(m[1])) return m[1];
          }
        }
      } catch { /* ignore */ }

      try {
        let container: Element | null = el;
        for (let i = 0; i < 15 && container; i++, container = container.parentElement) {
          const links = container.querySelectorAll('a[href^="/"]');
          for (const a of links) {
            const href = a.getAttribute('href');
            const m = href?.match(/^\/([a-zA-Z0-9._]{1,30})\/?$/);
            if (m && !reserved.has(m[1])) return m[1];
          }
          if (container.tagName === 'ARTICLE' || container.tagName === 'MAIN') break;
        }
      } catch { /* ignore */ }

      return null;
    }

    function findIgShortcode(el: Element): string | null {
      const urlMatch = location.pathname.match(/\/(reel|reels|p)\/([A-Za-z0-9_-]+)/);
      if (urlMatch) return urlMatch[2];

      let container: Element | null = el;
      for (let i = 0; i < 10 && container; i++, container = container.parentElement) {
        const links = container.querySelectorAll('a[href*="/reel/"], a[href*="/p/"]');
        for (const a of links) {
          const m = a.getAttribute('href')?.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/);
          if (m) return m[2];
        }
        if (container.tagName === 'ARTICLE' || container.tagName === 'MAIN') break;
      }
      return null;
    }

    // Events
    function onHover(e: MouseEvent): void {
      if (!metaDown) return;
      if (!isContextValid()) { deactivate(); return; }
      const el = e.target as Element;
      if (el.closest('video') || getImageSrc(el)) {
        if (isLargeEnough(el)) el.classList.add('devlens-hover');
      }
    }

    function onHoverOut(e: MouseEvent): void {
      (e.target as Element).classList.remove('devlens-hover');
    }

    function onClick(e: MouseEvent): void {
      if (!metaDown) return;
      if (!isContextValid()) { deactivate(); return; }

      // Phase 1: Check if click coordinates directly overlap a video element
      let foundVideo: HTMLVideoElement | null = null;
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

      // Phase 2: If click is directly on a video, handle as video
      if (foundVideo) {
        const videoInfo = getVideoInfo(foundVideo);
        if (videoInfo) {
          e.preventDefault();
          e.stopPropagation();

          if (location.hostname.includes('instagram.com')) {
            videoInfo.igUsername = findIgUsername(e.target as Element);
            videoInfo.igShortcode = findIgShortcode(e.target as Element);
          }

          safeSendMessage({ action: 'videoSelected', videoInfo });
          return;
        }
      }

      // Phase 3: Try image detection (takes priority over parent-traversal video search)
      const img = (e.target as Element).closest('img') as HTMLImageElement | null;
      let src: string | null = null;
      if (img && isLargeEnough(img)) {
        src = img.src;
      } else {
        src = getImageSrc(e.target as Element);
      }

      if (src) {
        e.preventDefault();
        e.stopPropagation();

        const imgEl = (e.target as Element).closest('img') || (e.target as Element).querySelector('img');
        const pageInfo = {
          renderWidth: (imgEl as HTMLImageElement)?.clientWidth || (e.target as HTMLElement).clientWidth,
          renderHeight: (imgEl as HTMLImageElement)?.clientHeight || (e.target as HTMLElement).clientHeight,
          naturalWidth: (imgEl as HTMLImageElement)?.naturalWidth || 0,
          naturalHeight: (imgEl as HTMLImageElement)?.naturalHeight || 0,
          alt: (imgEl as HTMLImageElement)?.alt || '',
        };

        safeSendMessage({ action: 'imageSelected', src, pageInfo });
        return;
      }

      // Phase 4: Fallback — search parent elements for video (non-image, non-direct-video clicks)
      const videoInfo = getVideoInfo(e.target as Element);
      if (videoInfo) {
        e.preventDefault();
        e.stopPropagation();

        if (location.hostname.includes('instagram.com')) {
          videoInfo.igUsername = findIgUsername(e.target as Element);
          videoInfo.igShortcode = findIgShortcode(e.target as Element);
        }

        safeSendMessage({ action: 'videoSelected', videoInfo });
        return;
      }
    }

    // Messages from background
    if (isContextValid()) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (!isContextValid()) return;
        if (msg.action === 'activateInspector') activate();
        if (msg.action === 'deactivateInspector') deactivate();
        if (msg.action === 'activateOverlay') activateOverlay();
        if (msg.action === 'deactivateOverlay') deactivateOverlay();
        if (msg.action === 'overlayResultBatch') handleOverlayResultBatch(msg.results);
        if (msg.action === 'downloadCapture') {
          window.postMessage({ __devlens_download_capture: true, filename: msg.filename || 'video', blobUrl: msg.blobUrl || '' }, '*');
        }
      });

      safeSendMessage({ action: 'contentReady' });
    }
  },
});
