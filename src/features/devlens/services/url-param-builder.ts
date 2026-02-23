import type { DetectedUrlParam } from '../types';

export function buildModifiedUrl(originalUrl: string, params: DetectedUrlParam[]): string {
  let url = originalUrl;
  try {
    const u = new URL(url);

    for (const p of params) {
      if (p.value === p.originalValue) continue;

      switch (p.source) {
        case 'query':
          u.searchParams.set(p.key!, String(p.value));
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
              `/${wp.value}x${hp.value}`,
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
              `-${wp.value}x${hp.value}.`,
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
          const oldType = p.rawTypeValue || '';
          const newType = oldType.replace(/([wh])\d+/, `$1${p.value}`);
          u.searchParams.set('type', newType);
          break;
        }
      }
    }
    url = u.toString();
  } catch { /* ignore */ }
  return url;
}

export function buildBestQualityUrl(url: string, params: DetectedUrlParam[]): string {
  try {
    const u = new URL(url);
    const handled = new Set<string>();

    for (const p of params) {
      if (handled.has(p.source + ':' + p.type)) continue;

      switch (p.source) {
        case 'query':
          if (['width', 'height', 'size'].includes(p.type)) {
            u.searchParams.delete(p.key!);
          } else if (p.type === 'quality') {
            u.searchParams.set(p.key!, String(p.max || 100));
          } else if (p.type === 'dpr') {
            u.searchParams.delete(p.key!);
          } else if (p.type === 'preset') {
            u.searchParams.set(p.key!, 'orig');
          } else if (p.type === 'format') {
            u.searchParams.delete(p.key!);
          }
          break;

        case 'cloudinary': {
          const cloudRe = /\/((?:[a-z]{1,2}_[^/,]+,?\s*){2,})\//i;
          const m = u.pathname.match(cloudRe);
          if (m) {
            const transforms = m[1].split(',').map(t => t.trim());
            const filtered = transforms
              .filter(t => !/^[wh]_\d+$/.test(t))
              .map(t => /^q_\d+$/.test(t) ? 'q_100' : t);
            u.pathname = u.pathname.replace(m[1], filtered.join(','));
          }
          handled.add('cloudinary:width');
          handled.add('cloudinary:height');
          handled.add('cloudinary:quality');
          break;
        }

        case 'google':
          url = url.replace(/=[swh]\d+(?:-[swh]\d+(?:-[a-z]*)?)*$/, '=s0');
          return url;

        case 'naver_path':
          u.pathname = u.pathname.replace(/\/type\/[wh]\d+(_\d+)?/, '');
          handled.add('naver_path:width');
          handled.add('naver_path:height');
          break;

        case 'wordpress': {
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
          const wd = params.find(x => x.type === 'width' && x.source === 'path_dim');
          const hd = params.find(x => x.type === 'height' && x.source === 'path_dim');
          if (wd && hd) {
            u.pathname = u.pathname.replace(
              `/${wd.originalValue}x${hd.originalValue}`,
              `/${Number(wd.originalValue) * 4}x${Number(hd.originalValue) * 4}`,
            );
          }
          handled.add('path_dim:width');
          handled.add('path_dim:height');
          break;
        }

        case 'naver_query': {
          const currentType = u.searchParams.get('type') || '';
          const newType = currentType.replace(/([wh])\d+/, '$19999');
          u.searchParams.set('type', newType);
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

export function detectCdnName(params: DetectedUrlParam[]): string | null {
  const source = params[0]?.source;
  const names: Record<string, string> = {
    cloudinary: 'Cloudinary',
    google: 'Google',
    naver_path: 'Naver',
    naver_query: 'Naver',
    wordpress: 'WordPress',
    shopify: 'Shopify',
  };
  return names[source] || null;
}
