import type { DetectedUrlParam } from '../types';

export function analyzeImageUrl(url: string): DetectedUrlParam[] {
  if (!url || url.startsWith('data:')) return [];
  const detected: DetectedUrlParam[] = [];

  try {
    const u = new URL(url);
    const path = u.pathname;

    // 1) Query parameters
    const qPatterns: { re: RegExp; type: DetectedUrlParam['type']; label: string; unit?: string; max?: number; preset?: string[] }[] = [
      { re: /^(w|width|iw|imageWidth|img_w|W)$/, type: 'width', label: '너비', unit: 'px' },
      { re: /^(h|height|ih|imageHeight|img_h|H)$/, type: 'height', label: '높이', unit: 'px' },
      { re: /^(q|quality|Q|qlty)$/, type: 'quality', label: '품질', unit: '', max: 100 },
      { re: /^(s|size)$/, type: 'size', label: '크기', unit: 'px' },
      { re: /^(dpr|pixel_ratio)$/, type: 'dpr', label: 'DPR', unit: 'x' },
      { re: /^(f|fm|format|output|ext|auto)$/, type: 'format', label: '포맷', preset: ['auto', 'webp', 'avif', 'jpg', 'png', 'gif'] },
      { re: /^(name)$/, type: 'preset', label: '프리셋', preset: ['small', 'medium', 'large', 'orig', '4096x4096'] },
      { re: /^(crop|fit|resize|mode)$/, type: 'fit', label: '맞춤', preset: ['cover', 'contain', 'fill', 'crop', 'scale-down'] },
    ];

    for (const [key, value] of u.searchParams) {
      for (const p of qPatterns) {
        if (p.re.test(key)) {
          detected.push({
            type: p.type, label: p.label, key, value: p.preset ? value : (Number(value) || value),
            originalValue: p.preset ? value : (Number(value) || value),
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
        if (k === 'w' && /^\d+$/.test(v)) detected.push({ type: 'width', label: '너비', key: 'w', value: parseInt(v), originalValue: parseInt(v), source: 'cloudinary', unit: 'px' });
        if (k === 'h' && /^\d+$/.test(v)) detected.push({ type: 'height', label: '높이', key: 'h', value: parseInt(v), originalValue: parseInt(v), source: 'cloudinary', unit: 'px' });
        if (k === 'q' && /^\d+$/.test(v)) detected.push({ type: 'quality', label: '품질', key: 'q', value: parseInt(v), originalValue: parseInt(v), source: 'cloudinary', unit: '', max: 100 });
        if (k === 'f') detected.push({ type: 'format', label: '포맷', key: 'f', value: v, originalValue: v, source: 'cloudinary', presets: ['auto', 'webp', 'avif', 'jpg', 'png'] });
      }
    }

    // 3) Google/YouTube: =s800 =w800 =w800-h600 =s0 (original)
    const isGoogle = /\.(google|gstatic|ggpht|googleusercontent|ytimg)\./.test(u.hostname);
    if (isGoogle) {
      const googleMatch = url.match(/=([swh]\d+(?:-[swh]\d+(?:-[a-z]*)?)*)$/);
      if (googleMatch) {
        for (const p of googleMatch[1].split('-')) {
          if (/^s\d+$/i.test(p)) detected.push({ type: 'size', label: '크기', key: 's', value: parseInt(p.slice(1)), originalValue: parseInt(p.slice(1)), source: 'google', unit: 'px', hint: '0 = 원본' });
          if (/^w\d+$/i.test(p)) detected.push({ type: 'width', label: '너비', key: 'w', value: parseInt(p.slice(1)), originalValue: parseInt(p.slice(1)), source: 'google', unit: 'px' });
          if (/^h\d+$/i.test(p)) detected.push({ type: 'height', label: '높이', key: 'h', value: parseInt(p.slice(1)), originalValue: parseInt(p.slice(1)), source: 'google', unit: 'px' });
        }
      }
    }

    // 4) Naver (pstatic.net, naver.net 등)
    const naverTypeParam = u.searchParams.get('type');
    if (naverTypeParam) {
      const naverQMatch = naverTypeParam.match(/^([wh])(\d+)/);
      if (naverQMatch) {
        const t = naverQMatch[1] === 'w' ? 'width' : 'height' as const;
        detected.push({
          type: t, label: t === 'width' ? '너비' : '높이',
          key: 'type', value: parseInt(naverQMatch[2]),
          originalValue: parseInt(naverQMatch[2]),
          source: 'naver_query', unit: 'px',
          rawTypeValue: naverTypeParam,
          dimChar: naverQMatch[1],
        });
      }
    }
    if (!detected.find(p => p.source === 'naver_query')) {
      const naverPathMatch = path.match(/\/type\/([wh])(\d+)/);
      if (naverPathMatch) {
        const t = naverPathMatch[1] === 'w' ? 'width' : 'height' as const;
        detected.push({ type: t, label: t === 'width' ? '너비' : '높이', key: naverPathMatch[1], value: parseInt(naverPathMatch[2]), originalValue: parseInt(naverPathMatch[2]), source: 'naver_path', unit: 'px' });
      }
    }

    // 5) Dimension in path: /800x600/
    if (!detected.find(p => p.type === 'width')) {
      const dimMatch = path.match(/\/(\d{2,5})x(\d{2,5})(\/|$)/);
      if (dimMatch) {
        detected.push({ type: 'width', label: '너비', key: null, value: parseInt(dimMatch[1]), originalValue: parseInt(dimMatch[1]), source: 'path_dim', unit: 'px', origDim: dimMatch[0] });
        detected.push({ type: 'height', label: '높이', key: null, value: parseInt(dimMatch[2]), originalValue: parseInt(dimMatch[2]), source: 'path_dim', unit: 'px', origDim: dimMatch[0] });
      }
    }

    // 6) WordPress: filename-800x600.jpg
    if (!detected.find(p => p.type === 'width')) {
      const wpMatch = path.match(/-(\d{2,5})x(\d{2,5})\.(jpe?g|png|gif|webp)/i);
      if (wpMatch) {
        detected.push({ type: 'width', label: '너비', key: null, value: parseInt(wpMatch[1]), originalValue: parseInt(wpMatch[1]), source: 'wordpress', unit: 'px' });
        detected.push({ type: 'height', label: '높이', key: null, value: parseInt(wpMatch[2]), originalValue: parseInt(wpMatch[2]), source: 'wordpress', unit: 'px' });
      }
    }

    // 7) Shopify: _800x600.jpg or _800x.jpg
    if (!detected.find(p => p.type === 'width')) {
      const shopMatch = path.match(/_(\d{2,5})x(\d{0,5})\.(jpe?g|png|gif|webp)/i);
      if (shopMatch) {
        detected.push({ type: 'width', label: '너비', key: null, value: parseInt(shopMatch[1]), originalValue: parseInt(shopMatch[1]), source: 'shopify', unit: 'px' });
        if (shopMatch[2]) detected.push({ type: 'height', label: '높이', key: null, value: parseInt(shopMatch[2]), originalValue: parseInt(shopMatch[2]), source: 'shopify', unit: 'px' });
      }
    }
  } catch { /* ignore */ }

  return detected;
}
