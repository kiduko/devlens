import { parseExif } from '../../../src/features/devlens/services/exif-parser';
import { tryAutoSave } from '../../../src/features/devlens/services/auto-save';

export const URL_AUTH_PARAM_NAMES = [
  'sig', 'signature', 'token', 'auth', 'hmac',
  'access_token', 'api_key', 'apikey', 'key',
  'X-Amz-Signature', 'X-Amz-Credential', 'X-Amz-Date', 'X-Amz-Expires',
  'X-Amz-Algorithm', 'X-Amz-Security-Token',
  'X-Goog-Signature', 'X-Goog-Credential', 'X-Goog-Date', 'X-Goog-Expires',
];

export async function processImage(url: string, pageInfo: any, sendToPanel: (msg: any) => void): Promise<void> {
  sendToPanel({ action: 'imageLoading', src: url });

  let pageUrl: string | null = null;
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.url) pageUrl = activeTab.url;
  } catch { /* ignore */ }

  try {
    let response = await fetch(url, { credentials: 'include' });

    const ct = response.headers.get('content-type') || '';
    if (!ct.includes('image') && !ct.includes('octet-stream')) {
      try { response = await fetch(url, { credentials: 'omit' }); } catch { /* ignore */ }
    }

    // Access analysis
    const u = new URL(url);
    const foundAuthParams: string[] = [];
    for (const name of URL_AUTH_PARAM_NAMES) {
      for (const [k, v] of u.searchParams.entries()) {
        if (k.toLowerCase() === name.toLowerCase() && v) {
          foundAuthParams.push(k);
        }
      }
    }

    let cookieInfo = { authCookies: [] as string[], totalCookies: 0 };
    try {
      const cookies = await chrome.cookies.getAll({ url: u.origin });
      const authPattern = /auth|session|token|jwt|sid|login|user|credential|connect\.sid|PHPSESSID|_csrf/i;
      cookieInfo = {
        authCookies: cookies.filter(c => authPattern.test(c.name)).map(c => c.name),
        totalCookies: cookies.length,
      };
    } catch { /* ignore */ }

    const hasSigned = foundAuthParams.length > 0;
    let needsCookie = false;

    try {
      const testResp = await fetch(url, { credentials: 'omit', cache: 'no-store' });
      if (!testResp.ok) {
        needsCookie = true;
      } else {
        const testCt = testResp.headers.get('content-type') || '';
        if (!testCt.includes('image') && !testCt.includes('octet-stream')) {
          needsCookie = true;
        } else {
          const reader = testResp.body!.getReader();
          const { value } = await reader.read();
          reader.cancel();
          if (!value || value.length < 2) {
            needsCookie = true;
          } else {
            const b0 = value[0], b1 = value[1];
            const isImage = (
              (b0 === 0xFF && b1 === 0xD8) ||
              (b0 === 0x89 && b1 === 0x50) ||
              (b0 === 0x47 && b1 === 0x49) ||
              (b0 === 0x52 && b1 === 0x49) ||
              (b0 === 0x42 && b1 === 0x4D) ||
              (b0 === 0x3C)
            );
            if (!isImage) needsCookie = true;
          }
        }
      }
    } catch {
      needsCookie = true;
    }

    let credentialMode: 'none' | 'signed' | 'cookie' | 'signed+cookie' = 'none';
    if (hasSigned && needsCookie) credentialMode = 'signed+cookie';
    else if (hasSigned) credentialMode = 'signed';
    else if (needsCookie) credentialMode = 'cookie';

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => { headers[key] = value; });

    const contentType = headers['content-type'] || '';
    const buffer = await response.arrayBuffer();

    let exif = null;
    const isJpeg = buffer.byteLength >= 2 &&
      new DataView(buffer).getUint8(0) === 0xFF &&
      new DataView(buffer).getUint8(1) === 0xD8;

    if (contentType.includes('jpeg') || contentType.includes('jpg') || isJpeg) {
      try { exif = parseExif(buffer); } catch { /* parse error */ }
    }

    let thumbDataUrl = '';
    if (buffer.byteLength < 5 * 1024 * 1024) {
      try {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        thumbDataUrl = `data:${contentType || 'image/png'};base64,${btoa(binary)}`;
      } catch { /* ignore */ }
    }

    sendToPanel({
      action: 'imageData',
      data: {
        src: url,
        thumbDataUrl,
        contentType,
        fileSize: buffer.byteLength,
        headers,
        pageInfo,
        pageUrl,
        exif,
        status: response.status,
        statusText: response.statusText,
        credentialMode,
        cookieInfo,
        urlAuthParams: foundAuthParams,
      },
    });

    await tryAutoSave(url, contentType, pageUrl, sendToPanel);
  } catch (err: any) {
    sendToPanel({ action: 'imageError', src: url, error: err.message });
  }
}
