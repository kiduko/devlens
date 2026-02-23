export function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return 'N/A';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

export function formatContentType(ct: string | undefined): string {
  const map: Record<string, string> = {
    'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/gif': 'GIF',
    'image/webp': 'WebP', 'image/svg+xml': 'SVG', 'image/avif': 'AVIF',
    'image/bmp': 'BMP', 'image/tiff': 'TIFF',
  };
  for (const [k, v] of Object.entries(map)) {
    if (ct && ct.includes(k)) return v;
  }
  return ct || 'Unknown';
}

export function formatDuration(sec: number): string {
  if (!sec || !isFinite(sec)) return 'N/A';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function extractFilename(url: string): string | null {
  try {
    const n = new URL(url).pathname.split('/').pop();
    if (n && n.includes('.')) return decodeURIComponent(n);
  } catch { /* ignore */ }
  return null;
}

export function extractHostname(pageUrl: string): string {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, '');
  } catch { return 'unknown'; }
}

export function escShell(str: string): string {
  return str.replace(/'/g, "'\\''");
}
