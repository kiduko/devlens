import type { OverlayBadgeData } from '../../src/features/devlens/types';

let active = false;
let intersectionObserver: IntersectionObserver | null = null;
let mutationObserver: MutationObserver | null = null;

// Track processed images and their badges
const badgeMap = new WeakMap<HTMLImageElement, { host: HTMLElement; badge: HTMLElement; requestId: string }>();
const analyzedUrls = new Map<string, OverlayBadgeData>();
const pendingQueue: { src: string; requestId: string }[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;
let requestCounter = 0;
const pendingRequests = new Map<string, HTMLImageElement>();

const MIN_SIZE = 50;
const BATCH_DELAY = 200;
const BATCH_MAX = 10;

function isContextValid(): boolean {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '? KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatType(contentType: string): string {
  if (!contentType) return '?';
  const ct = contentType.toLowerCase();
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'JPEG';
  if (ct.includes('png')) return 'PNG';
  if (ct.includes('gif')) return 'GIF';
  if (ct.includes('webp')) return 'WebP';
  if (ct.includes('avif')) return 'AVIF';
  if (ct.includes('svg')) return 'SVG';
  if (ct.includes('bmp')) return 'BMP';
  if (ct.includes('ico')) return 'ICO';
  if (ct.includes('tiff')) return 'TIFF';
  return contentType.split('/').pop()?.toUpperCase() || '?';
}

function getCredentialColor(mode: OverlayBadgeData['credentialMode']): string {
  switch (mode) {
    case 'none': return '#22c55e';        // green
    case 'signed': return '#eab308';      // yellow
    case 'cookie': return '#f97316';      // orange
    case 'signed+cookie': return '#ef4444'; // red
  }
}

function createBadge(img: HTMLImageElement, data?: OverlayBadgeData): { host: HTMLElement; badge: HTMLElement } {
  const host = document.createElement('devlens-overlay');
  host.style.cssText = 'position:absolute;top:4px;left:4px;z-index:2147483647;pointer-events:auto;';

  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    :host { display: block; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px;
      border-radius: 4px;
      background: rgba(0,0,0,0.78);
      color: #fff;
      font: 500 11px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
      backdrop-filter: blur(4px);
      transition: opacity 0.15s;
    }
    .badge:hover { opacity: 0.85; }
    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .sep { opacity: 0.5; }
    .loading {
      color: rgba(255,255,255,0.6);
      font-style: italic;
    }
  `;

  const badge = document.createElement('div');
  badge.className = 'badge';

  if (data) {
    updateBadgeContent(badge, img, data);
  } else {
    badge.innerHTML = '<span class="loading">analyzing...</span>';
  }

  badge.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isContextValid()) return;
    const pageInfo = {
      renderWidth: img.clientWidth,
      renderHeight: img.clientHeight,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      alt: img.alt || '',
    };
    try {
      chrome.runtime.sendMessage({ action: 'imageSelected', src: img.src, pageInfo });
    } catch { /* context invalidated */ }
  });

  shadow.appendChild(style);
  shadow.appendChild(badge);
  return { host, badge };
}

function updateBadgeContent(badge: HTMLElement, img: HTMLImageElement, data: OverlayBadgeData): void {
  const color = getCredentialColor(data.credentialMode);
  const type = formatType(data.contentType);
  const size = formatFileSize(data.fileSize);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const resolution = (w && h) ? `${w}x${h}` : '';

  const parts = [type, size];
  if (resolution) parts.push(resolution);

  badge.innerHTML = `<span class="dot" style="background:${color}"></span>${parts.join(' <span class="sep">|</span> ')}`;
}

function ensureRelativeParent(img: HTMLImageElement): void {
  const parent = img.parentElement;
  if (!parent) return;
  const pos = getComputedStyle(parent).position;
  if (pos === 'static') {
    parent.style.position = 'relative';
  }
}

function attachBadge(img: HTMLImageElement): void {
  if (badgeMap.has(img)) return;
  const src = img.src;
  if (!src || src.startsWith('data:')) return;

  const rect = img.getBoundingClientRect();
  if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) return;

  ensureRelativeParent(img);

  const cached = analyzedUrls.get(src);
  const { host, badge } = createBadge(img, cached);

  img.parentElement!.appendChild(host);
  const requestId = `ovl_${++requestCounter}`;
  badgeMap.set(img, { host, badge, requestId });

  if (!cached) {
    pendingRequests.set(requestId, img);
    enqueue(src, requestId);
  }
}

function removeBadge(img: HTMLImageElement): void {
  const entry = badgeMap.get(img);
  if (!entry) return;
  entry.host.remove();
  badgeMap.delete(img);
  pendingRequests.delete(entry.requestId);
}

function enqueue(src: string, requestId: string): void {
  pendingQueue.push({ src, requestId });
  if (pendingQueue.length >= BATCH_MAX) {
    flushQueue();
  } else if (!batchTimer) {
    batchTimer = setTimeout(flushQueue, BATCH_DELAY);
  }
}

function flushQueue(): void {
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }
  if (pendingQueue.length === 0) return;
  if (!isContextValid()) return;

  const items = pendingQueue.splice(0, BATCH_MAX);
  try {
    chrome.runtime.sendMessage({ action: 'overlayAnalyzeBatch', items });
  } catch { /* context invalidated */ }

  // If there are still items queued, schedule next flush
  if (pendingQueue.length > 0) {
    batchTimer = setTimeout(flushQueue, BATCH_DELAY);
  }
}

function scanImages(): void {
  const images = document.querySelectorAll<HTMLImageElement>('img');
  for (const img of images) {
    if (intersectionObserver) {
      intersectionObserver.observe(img);
    }
  }
}

function removeAllBadges(): void {
  document.querySelectorAll('devlens-overlay').forEach((el) => el.remove());
}

export function activateOverlay(): void {
  if (active) return;
  active = true;

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const img = entry.target as HTMLImageElement;
        if (entry.isIntersecting) {
          attachBadge(img);
        }
      }
    },
    { rootMargin: '100px' },
  );

  mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLImageElement) {
          intersectionObserver!.observe(node);
        } else if (node instanceof HTMLElement) {
          const imgs = node.querySelectorAll<HTMLImageElement>('img');
          for (const img of imgs) {
            intersectionObserver!.observe(img);
          }
        }
      }
    }
  });

  mutationObserver.observe(document.body, { childList: true, subtree: true });

  scanImages();
}

export function deactivateOverlay(): void {
  if (!active) return;
  active = false;

  intersectionObserver?.disconnect();
  intersectionObserver = null;
  mutationObserver?.disconnect();
  mutationObserver = null;

  removeAllBadges();
  pendingQueue.length = 0;
  pendingRequests.clear();
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }
}

export function handleOverlayResultBatch(
  results: { requestId: string; result: OverlayBadgeData }[],
): void {
  for (const { requestId, result } of results) {
    analyzedUrls.set(result.src, result);
    const img = pendingRequests.get(requestId);
    pendingRequests.delete(requestId);
    if (!img) continue;

    const entry = badgeMap.get(img);
    if (!entry) continue;

    updateBadgeContent(entry.badge, img, result);
  }
}
