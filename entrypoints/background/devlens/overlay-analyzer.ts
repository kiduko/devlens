import { URL_AUTH_PARAM_NAMES } from './image-processor';
import type { OverlayBadgeData } from '../../../src/features/devlens/types';

interface CacheEntry {
  data: OverlayBadgeData;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

function cleanCache(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > CACHE_TTL) cache.delete(key);
  }
}

async function analyzeForOverlay(src: string): Promise<OverlayBadgeData> {
  // Check cache
  const cached = cache.get(src);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // HEAD request with credentials
    const response = await fetch(src, { method: 'HEAD', credentials: 'include' });

    const contentType = response.headers.get('content-type') || '';
    const contentLength = response.headers.get('content-length');
    const fileSize = contentLength ? parseInt(contentLength, 10) : 0;

    // URL auth param detection
    const u = new URL(src);
    const foundAuthParams: string[] = [];
    for (const name of URL_AUTH_PARAM_NAMES) {
      for (const [k, v] of u.searchParams.entries()) {
        if (k.toLowerCase() === name.toLowerCase() && v) {
          foundAuthParams.push(k);
        }
      }
    }

    const hasSigned = foundAuthParams.length > 0;
    let needsCookie = false;

    // HEAD without credentials to test cookie dependency
    try {
      const testResp = await fetch(src, { method: 'HEAD', credentials: 'omit', cache: 'no-store' });
      if (!testResp.ok) {
        needsCookie = true;
      } else {
        const testCt = testResp.headers.get('content-type') || '';
        if (!testCt.includes('image') && !testCt.includes('octet-stream')) {
          needsCookie = true;
        }
      }
    } catch {
      needsCookie = true;
    }

    let credentialMode: OverlayBadgeData['credentialMode'] = 'none';
    if (hasSigned && needsCookie) credentialMode = 'signed+cookie';
    else if (hasSigned) credentialMode = 'signed';
    else if (needsCookie) credentialMode = 'cookie';

    const result: OverlayBadgeData = {
      src,
      contentType,
      fileSize,
      credentialMode,
      status: response.status,
    };

    cache.set(src, { data: result, timestamp: Date.now() });
    return result;
  } catch (err: any) {
    const result: OverlayBadgeData = {
      src,
      contentType: '',
      fileSize: 0,
      credentialMode: 'none',
      status: 0,
      error: err.message,
    };
    return result;
  }
}

export async function analyzeBatch(
  items: { src: string; requestId: string }[],
  maxConcurrent = 5,
): Promise<{ requestId: string; result: OverlayBadgeData }[]> {
  // Periodically clean cache
  if (cache.size > 100) cleanCache();

  const results: { requestId: string; result: OverlayBadgeData }[] = [];
  let index = 0;

  async function next(): Promise<void> {
    while (index < items.length) {
      const item = items[index++];
      const result = await analyzeForOverlay(item.src);
      results.push({ requestId: item.requestId, result });
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrent, items.length) }, () => next());
  await Promise.all(workers);

  return results;
}
