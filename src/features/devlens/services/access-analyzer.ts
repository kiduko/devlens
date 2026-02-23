import type { AccessItem, CookieInfo } from '../types';

function formatDurationMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 ${s % 60}초`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 ${m % 60}분`;
  const d = Math.floor(h / 24);
  return `${d}일 ${h % 24}시간`;
}

export function analyzeAccess(
  url: string,
  headers: Record<string, string>,
  credentialMode: string,
  status: number,
  cookieInfo: CookieInfo | undefined,
  urlAuthParams: string[] | undefined,
): AccessItem[] {
  const items: AccessItem[] = [];

  try {
    const u = new URL(url);
    const params = u.searchParams;
    const lowerHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) lowerHeaders[k.toLowerCase()] = v;

    // 1) Signed URL detection — provider-specific params
    const providerParams: Record<string, string> = {
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

    // Azure SAS
    const azureKeys = ['sig', 'sv', 'se', 'sp', 'ss', 'srt', 'st', 'spr'];
    const azureFound = azureKeys.filter(k => params.has(k));
    const isAzure = azureFound.includes('sig') && azureFound.includes('sv') && azureFound.length >= 3;

    const foundSigned: { key: string; label: string; value: string }[] = [];
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

    // Generic auth params
    const genericAuthParams: Record<string, string> = {
      'signature': '서명 값',
      'token': '액세스 토큰',
      'auth': '인증 파라미터',
      'api_key': 'API 키',
      'apikey': 'API 키',
      'access_token': '액세스 토큰',
    };
    const foundGeneric: { key: string; label: string; value: string }[] = [];
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
        if (secs) items.push({ icon: '⏳', label: '유효 기간', desc: formatDurationMs(secs * 1000), level: 'info' });
      } else if (azureExpires) {
        const expDate = new Date(azureExpires);
        const remaining = expDate.getTime() - Date.now();
        if (remaining > 0) {
          items.push({ icon: '⏳', label: '만료 시간', desc: formatDurationMs(remaining), level: 'info' });
        } else {
          items.push({ icon: '⛔', label: '만료됨', desc: '서명 URL이 만료되었습니다', level: 'error' });
        }
      }

      for (const s of foundSigned) {
        const masked = s.value.length > 20 ? s.value.substring(0, 10) + '···' + s.value.slice(-6) : s.value;
        items.push({ icon: '🔑', label: s.key, desc: masked, level: 'detail' });
      }
    }

    if (foundGeneric.length > 0 && foundSigned.length === 0) {
      items.push({ icon: '🔐', label: 'Signed URL', desc: `인증 파라미터 ${foundGeneric.length}개 감지`, level: 'warn' });
      for (const s of foundGeneric) {
        const masked = s.value.length > 20 ? s.value.substring(0, 10) + '···' + s.value.slice(-6) : s.value;
        items.push({ icon: '🔑', label: `${s.label} (${s.key})`, desc: masked, level: 'detail' });
      }
    }

    // 2) Access requirement
    const ci = cookieInfo || { authCookies: [], totalCookies: 0 };
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
      const maxAge = cacheControl.match(/max-age=(\d+)/);
      if (maxAge) {
        items.push({ icon: '⏱️', label: '캐시 유효', desc: formatDurationMs(parseInt(maxAge[1]) * 1000), level: 'detail' });
      }
    }

    // 5) CDN identification
    const cdnHeaders: Record<string, string | null> = {
      'x-amz-cf-id': 'Amazon CloudFront',
      'x-amz-cf-pop': 'Amazon CloudFront',
      'cf-ray': 'Cloudflare',
      'cf-cache-status': 'Cloudflare',
      'x-fastly-request-id': 'Fastly',
      'x-served-by': 'Fastly / Varnish',
      'x-cache': null,
      'x-cdn': null,
      'server': null,
      'via': null,
    };
    const detectedCdns = new Set<string>();
    for (const [hdr, name] of Object.entries(cdnHeaders)) {
      const val = lowerHeaders[hdr];
      if (!val) continue;
      if (name) { detectedCdns.add(name); continue; }
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
    if (contentDisp?.includes('attachment')) {
      items.push({ icon: '📎', label: '다운로드 강제', desc: 'Content-Disposition: attachment', level: 'info' });
    }

    // 7) Direct access
    if (foundSigned.length === 0 && foundGeneric.length === 0 && credentialMode === 'none' && !acao) {
      items.push({ icon: '✅', label: '직접 접근', desc: '인증 없이 URL로 직접 접근 가능', level: 'ok' });
    }
  } catch { /* ignore */ }

  return items;
}
