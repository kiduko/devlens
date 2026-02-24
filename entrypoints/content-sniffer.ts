// Runs in MAIN world to intercept fetch/XHR/MediaSource for stream URL capture.
// Communicates with content script via window.postMessage.

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  world: 'MAIN',
  runAt: 'document_start',

  main() {
    const sent = new Set<string>();

    const pushStream = (url: string, type?: string) => {
      if (!url || sent.has(url)) return;
      sent.add(url);
      try { window.postMessage({ __devlens_stream: url, __devlens_type: type || 'hls' }, '*'); } catch { /* ignore */ }
    };

    const pushSegment = (url: string) => {
      if (!url) return;
      try { window.postMessage({ __devlens_segment: url }, '*'); } catch { /* ignore */ }
    };

    // 1. Hook URL.createObjectURL — track MediaSource blob URLs
    const captureMap = new Map<string, { tracks: any[]; totalSize: number }>();

    const origCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (obj: any): string {
      const url = origCreateObjectURL(obj);
      if (obj instanceof MediaSource) {
        (obj as any).__devlens_blobUrl = url;
        captureMap.set(url, { tracks: [], totalSize: 0 });
        try { window.postMessage({ __devlens_msblob: url }, '*'); } catch { /* ignore */ }
      }
      return url;
    };

    // 2. MSE SourceBuffer capture
    const MAX_CAPTURE_BYTES = 200 * 1024 * 1024;
    let captureTotalSize = 0;

    const origAddSourceBuffer = MediaSource.prototype.addSourceBuffer;
    MediaSource.prototype.addSourceBuffer = function (mimeType: string) {
      const sb = origAddSourceBuffer.call(this, mimeType);
      const blobUrl = (this as any).__devlens_blobUrl;
      const track = { mimeType, chunks: [] as ArrayBuffer[], size: 0 };
      if (blobUrl && captureMap.has(blobUrl)) {
        captureMap.get(blobUrl)!.tracks.push(track);
      }
      (sb as any).__devlens_track = track;
      (sb as any).__devlens_blobUrl = blobUrl;
      return sb;
    };

    const origAppendBuffer = SourceBuffer.prototype.appendBuffer;
    SourceBuffer.prototype.appendBuffer = function (data: BufferSource) {
      const track = (this as any).__devlens_track;
      const blobUrl = (this as any).__devlens_blobUrl;
      if (track && captureTotalSize < MAX_CAPTURE_BYTES) {
        try {
          let buf: ArrayBuffer | undefined;
          if (data instanceof ArrayBuffer) {
            buf = data.slice(0);
          } else if (ArrayBuffer.isView(data)) {
            buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
          }
          if (buf) {
            track.chunks.push(buf);
            track.size += buf.byteLength;
            captureTotalSize += buf.byteLength;
            const cap = blobUrl ? captureMap.get(blobUrl) : null;
            if (cap) cap.totalSize += buf.byteLength;
            try {
              window.postMessage({
                __devlens_capture: {
                  blobUrl: blobUrl || '',
                  totalSize: cap ? cap.totalSize : track.size,
                  trackCount: cap ? cap.tracks.length : 1,
                  mimeTypes: cap ? cap.tracks.map((t: any) => t.mimeType) : [track.mimeType],
                },
              }, '*');
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }
      return origAppendBuffer.call(this, data);
    };

    // fMP4 → WebM Remuxer
    function remuxToWebM(chunks: ArrayBuffer[]): Uint8Array | null {
      try {
        let len = 0;
        for (const c of chunks) len += c.byteLength;
        const u8 = new Uint8Array(len);
        let p = 0;
        for (const c of chunks) { u8.set(new Uint8Array(c), p); p += c.byteLength; }
        const dv = new DataView(u8.buffer);

        let isVP9 = false;
        for (let i = 0; i < Math.min(len, 100) - 3; i++) {
          if (u8[i] === 0x76 && u8[i + 1] === 0x70 && u8[i + 2] === 0x30 && u8[i + 3] === 0x39) { isVP9 = true; break; }
        }
        if (!isVP9) return null;

        let W = 0, H = 0, ts = 0, dd = 0;
        const frags: any[] = [];

        function scan(s: number, e: number, fn: (id: string, s: number, e: number, bp: number) => void) {
          let p = s;
          while (p + 8 <= e) {
            let sz = dv.getUint32(p);
            const id = String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7]);
            let h = 8;
            if (sz === 1 && p + 16 <= e) { sz = Number(dv.getBigUint64(p + 8)); h = 16; }
            if (sz === 0) sz = e - p;
            if (sz < 8 || p + sz > e) break;
            fn(id, p + h, p + sz, p);
            p += sz;
          }
        }

        scan(0, len, (id, s, e, bp) => {
          if (id === 'moov') scan(s, e, (id2, s2, e2) => {
            if (id2 === 'mvex') scan(s2, e2, (id3, s3) => {
              if (id3 === 'trex') dd = dv.getUint32(s3 + 12);
            });
            if (id2 === 'trak') scan(s2, e2, (id3, s3, e3) => {
              if (id3 === 'tkhd') {
                const off = u8[s3] === 0 ? s3 + 76 : s3 + 88;
                if (!W) { W = dv.getUint16(off); H = dv.getUint16(off + 4); }
              }
              if (id3 === 'mdia') scan(s3, e3, (id4, s4, e4) => {
                if (id4 === 'mdhd') ts = u8[s4] === 0 ? dv.getUint32(s4 + 12) : dv.getUint32(s4 + 20);
                if (id4 === 'minf') scan(s4, e4, (id5, s5, e5) => {
                  if (id5 === 'stbl') scan(s5, e5, (id6, s6, e6) => {
                    if (id6 === 'stsd' && e6 - s6 > 44) {
                      const w = dv.getUint16(s6 + 40), h = dv.getUint16(s6 + 42);
                      if (w && h) { W = w; H = h; }
                    }
                  });
                });
              });
            });
          });
          if (id === 'moof') {
            const fr: any = { bt: 0, samps: [], ds: 0 };
            scan(s, e, (id2, s2, e2) => {
              if (id2 === 'traf') {
                let td = dd, tsz = 0, tf = 0;
                scan(s2, e2, (id3, s3) => {
                  if (id3 === 'tfhd') {
                    const fl = (u8[s3 + 1] << 16) | (u8[s3 + 2] << 8) | u8[s3 + 3];
                    let o = s3 + 8;
                    if (fl & 0x01) o += 8;
                    if (fl & 0x02) o += 4;
                    if (fl & 0x08) { td = dv.getUint32(o); o += 4; }
                    if (fl & 0x10) { tsz = dv.getUint32(o); o += 4; }
                    if (fl & 0x20) tf = dv.getUint32(o);
                  }
                  if (id3 === 'tfdt') fr.bt = u8[s3] === 0 ? dv.getUint32(s3 + 4) : Number(dv.getBigUint64(s3 + 4));
                  if (id3 === 'trun') {
                    const fl = (u8[s3 + 1] << 16) | (u8[s3 + 2] << 8) | u8[s3 + 3];
                    const n = dv.getUint32(s3 + 4);
                    let o = s3 + 8;
                    if (fl & 0x01) { fr.ds = bp + dv.getInt32(o); o += 4; }
                    let ff = tf;
                    if (fl & 0x04) { ff = dv.getUint32(o); o += 4; }
                    for (let i = 0; i < n; i++) {
                      let d = td, z = tsz, f = i === 0 ? ff : tf;
                      if (fl & 0x100) { d = dv.getUint32(o); o += 4; }
                      if (fl & 0x200) { z = dv.getUint32(o); o += 4; }
                      if (fl & 0x400) { f = dv.getUint32(o); o += 4; }
                      if (fl & 0x800) o += 4;
                      fr.samps.push({ d, z, k: ((f >> 24) & 3) !== 2 });
                    }
                  }
                });
              }
            });
            if (fr.samps.length) frags.push(fr);
          }
        });

        if (!W || !H || !ts || !frags.length) return null;

        const frames: any[] = [];
        for (const f of frags) {
          let t = f.bt, dp = f.ds;
          for (const s of f.samps) {
            frames.push({ ms: Math.round((t / ts) * 1000), sz: s.z, k: s.k, off: dp });
            t += s.d; dp += s.z;
          }
        }
        if (!frames.length) return null;

        const last = frags[frags.length - 1];
        let endTick = last.bt;
        for (const s of last.samps) endTick += s.d;
        const durMs = Math.round((endTick / ts) * 1000);

        // Write WebM
        function vid(id: number): number[] {
          if (id < 0x100) return [id];
          if (id < 0x10000) return [id >> 8, id & 0xFF];
          if (id < 0x1000000) return [id >> 16, (id >> 8) & 0xFF, id & 0xFF];
          return [(id >> 24) & 0xFF, (id >> 16) & 0xFF, (id >> 8) & 0xFF, id & 0xFF];
        }
        function vsz(s: number): number[] {
          if (s < 127) return [0x80 | s];
          if (s < 16383) return [0x40 | (s >> 8), s & 0xFF];
          if (s < 2097151) return [0x20 | (s >> 16), (s >> 8) & 0xFF, s & 0xFF];
          if (s < 268435455) return [0x10 | (s >>> 24), (s >> 16) & 0xFF, (s >> 8) & 0xFF, s & 0xFF];
          const hi = Math.floor(s / 0x100000000);
          return [0x01, (hi >> 16) & 0xFF, (hi >> 8) & 0xFF, hi & 0xFF, (s >>> 24) & 0xFF, (s >> 16) & 0xFF, (s >> 8) & 0xFF, s & 0xFF];
        }
        function cat(...a: (Uint8Array | number[])[]): Uint8Array {
          let n = 0; for (const x of a) n += x.length;
          const r = new Uint8Array(n); let o = 0;
          for (const x of a) { r.set(x instanceof Uint8Array ? x : new Uint8Array(x), o); o += x.length; }
          return r;
        }
        function el(id: number, d: Uint8Array | number[]): Uint8Array {
          const b = d instanceof Uint8Array ? d : new Uint8Array(d);
          return cat(vid(id), vsz(b.length), b);
        }
        function mel(id: number, ch: Uint8Array[]): Uint8Array {
          let n = 0; for (const c of ch) n += c.length;
          const d = new Uint8Array(n); let o = 0;
          for (const c of ch) { d.set(c, o); o += c.length; }
          return el(id, d);
        }
        function ui(id: number, v: number): Uint8Array {
          if (v <= 0xFF) return el(id, [v]);
          if (v <= 0xFFFF) return el(id, [v >> 8, v & 0xFF]);
          if (v <= 0xFFFFFF) return el(id, [v >> 16, (v >> 8) & 0xFF, v & 0xFF]);
          return el(id, [(v >>> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF]);
        }
        function str(id: number, s: string): Uint8Array { return el(id, new TextEncoder().encode(s)); }
        function f64(id: number, v: number): Uint8Array { const b = new ArrayBuffer(8); new DataView(b).setFloat64(0, v); return el(id, new Uint8Array(b)); }

        const hdr = mel(0x1A45DFA3, [
          ui(0x4286, 1), ui(0x42F7, 1), ui(0x42F2, 4), ui(0x42F3, 8),
          str(0x4282, 'webm'), ui(0x4287, 4), ui(0x4285, 2),
        ]);
        const info = mel(0x1549A966, [ui(0x2AD7B1, 1000000), f64(0x4489, durMs)]);
        const trks = mel(0x1654AE6B, [mel(0xAE, [
          ui(0xD7, 1), ui(0x73C5, 1), ui(0x83, 1), str(0x86, 'V_VP9'),
          mel(0xE0, [ui(0xB0, W), ui(0xBA, H)]),
        ])]);

        const clusters: Uint8Array[] = [];
        let cf: any[] = [], ct = frames[0].ms;
        for (const f of frames) {
          if (cf.length && f.k) {
            clusters.push(mkCl(ct, cf));
            cf = []; ct = f.ms;
          }
          cf.push(f);
        }
        if (cf.length) clusters.push(mkCl(ct, cf));

        function mkCl(startMs: number, cfs: any[]): Uint8Array {
          const ch: Uint8Array[] = [ui(0xE7, startMs)];
          for (const f of cfs) {
            const rel = f.ms - startMs;
            const bh = new Uint8Array([0x81, (rel >> 8) & 0xFF, rel & 0xFF, f.k ? 0x80 : 0]);
            ch.push(el(0xA3, cat(bh, u8.subarray(f.off, f.off + f.sz))));
          }
          return mel(0x1F43B675, ch);
        }

        const segParts = [info, trks, ...clusters];
        let segLen = 0; for (const pp of segParts) segLen += pp.length;
        return cat(hdr, vid(0x18538067), vsz(segLen), ...segParts);
      } catch { return null; }
    }

    // Handle download request from content script
    window.addEventListener('message', (e) => {
      if (!e.data || !e.data.__devlens_download_capture) return;

      const filename = e.data.filename || 'video';
      const targetBlobUrl = e.data.blobUrl;

      let target: any = null;
      if (targetBlobUrl && captureMap.has(targetBlobUrl)) {
        const cap = captureMap.get(targetBlobUrl)!;
        target = cap.tracks.find((t: any) => t.mimeType.includes('video'));
        if (!target && cap.tracks.length > 0) target = cap.tracks[0];
      }
      if (!target) {
        let bestSize = 0;
        for (const [, cap] of captureMap) {
          const vt = cap.tracks.find((t: any) => t.mimeType.includes('video'));
          if (vt && vt.size > bestSize) { target = vt; bestSize = vt.size; }
        }
      }

      if (!target || target.chunks.length === 0) {
        window.postMessage({ __devlens_capture_error: '캡처된 데이터가 없습니다' }, '*');
        return;
      }

      let blob: Blob, ext: string;
      const webm = remuxToWebM(target.chunks);
      if (webm) {
        blob = new Blob([webm], { type: 'video/webm' });
        ext = '.webm';
      } else if (target.mimeType.includes('webm')) {
        blob = new Blob(target.chunks, { type: 'video/webm' });
        ext = '.webm';
      } else {
        blob = new Blob(target.chunks, { type: target.mimeType.split(';')[0] });
        ext = target.mimeType.includes('mp2t') ? '.ts' : '.mp4';
      }

      const url = origCreateObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename + ext;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);

      window.postMessage({ __devlens_capture_done: true, size: blob.size }, '*');
    });

    // 3. Direct media URL capture
    const sentMedia = new Set<string>();

    function pushDirectMedia(url: string, mime: string) {
      try {
        const u = new URL(url);
        if (u.searchParams.has('sq')) return;
        const clen = u.searchParams.get('clen');
        u.searchParams.delete('range');
        u.searchParams.delete('rn');
        u.searchParams.delete('rbuf');
        const clean = u.toString();
        const key = mime + '|' + (u.searchParams.get('itag') || clean.substring(0, 120));
        if (sentMedia.has(key)) return;
        sentMedia.add(key);
        const info: any = { mime: mime || 'video/mp4' };
        const itag = u.searchParams.get('itag');
        if (itag) info.itag = itag;
        if (clen) info.size = parseInt(clen);
        window.postMessage({ __devlens_direct_media: clean, __devlens_media_info: info }, '*');
      } catch { /* ignore */ }
    }

    function checkDirectMedia(url: string, ct: string) {
      if (!url) return;
      if (url.includes('videoplayback') || url.includes('googlevideo.com')) {
        const mime = new URL(url).searchParams.get('mime') || ct || '';
        pushDirectMedia(url, decodeURIComponent(mime));
        return;
      }
      if (ct && (ct.startsWith('video/') || ct.startsWith('audio/'))) {
        pushDirectMedia(url, ct);
      }
    }

    // PerformanceObserver
    try {
      const perfObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const url = entry.name;
          if (url.includes('videoplayback') || url.includes('googlevideo.com')) {
            try {
              const mime = new URL(url).searchParams.get('mime') || '';
              pushDirectMedia(url, decodeURIComponent(mime));
            } catch { /* ignore */ }
          }
        }
      });
      perfObserver.observe({ type: 'resource', buffered: true });
    } catch { /* ignore */ }

    // Helpers
    function isManifestUrl(url: string): boolean {
      return /\.(m3u8|mpd)(\?|#|$)/i.test(url) ||
        /\/manifest\b/i.test(url) || /\/playlist\b/i.test(url);
    }

    function isSegmentUrl(url: string): boolean {
      return /\.(ts|m4s|m4v|m4a|mp4|aac|fmp4)(\?|#|$)/i.test(url);
    }

    function isManifestCt(ct: string): boolean {
      if (!ct) return false;
      return ct.includes('mpegurl') || ct.includes('dash+xml') || ct.includes('apple.mpegurl');
    }

    function typeFromUrl(url: string, ct?: string): string {
      if (url.includes('.mpd') || (ct && ct.includes('dash'))) return 'dash';
      return 'hls';
    }

    // 4. Enhanced fetch interception
    const origFetch = window.fetch;
    window.fetch = function (...args: any[]) {
      const req = args[0];
      const url = typeof req === 'string' ? req : req?.url;

      if (url) {
        if (isManifestUrl(url)) pushStream(url, typeFromUrl(url));
        else if (isSegmentUrl(url)) pushSegment(url);
      }

      const p = origFetch.apply(this, args);

      if (url) {
        p.then((resp: Response) => {
          const ct = (resp.headers.get('content-type') || '').toLowerCase();
          if (isManifestCt(ct)) {
            pushStream(url, typeFromUrl(url, ct));
            return;
          }
          checkDirectMedia(url, ct);
          if (!ct || ct.includes('octet-stream') || ct.includes('text/plain') || ct.includes('binary')) {
            resp.clone().text().then((text: string) => {
              const head = text.trimStart().substring(0, 200);
              if (head.startsWith('#EXTM3U')) pushStream(url, 'hls');
              else if (head.includes('<MPD')) pushStream(url, 'dash');
            }).catch(() => { /* ignore */ });
          }
        }).catch(() => { /* ignore */ });
      }

      return p;
    };

    // 5. Enhanced XHR interception
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
      (this as any).__devlens_url = typeof url === 'string' ? url : String(url || '');
      if ((this as any).__devlens_url) {
        if (isManifestUrl((this as any).__devlens_url)) pushStream((this as any).__devlens_url, typeFromUrl((this as any).__devlens_url));
        else if (isSegmentUrl((this as any).__devlens_url)) pushSegment((this as any).__devlens_url);
      }
      return origOpen.apply(this, [method, url, ...rest] as any);
    };

    XMLHttpRequest.prototype.send = function (...args: any[]) {
      this.addEventListener('load', function (this: XMLHttpRequest) {
        const url = (this as any).__devlens_url;
        if (!url) return;
        const ct = (this.getResponseHeader('content-type') || '').toLowerCase();
        if (isManifestCt(ct)) {
          pushStream(url, typeFromUrl(url, ct));
          return;
        }
        checkDirectMedia(url, ct);
        if (this.responseType === '' || this.responseType === 'text') {
          try {
            const head = (this.responseText || '').trimStart().substring(0, 200);
            if (head.startsWith('#EXTM3U')) pushStream(url, 'hls');
            else if (head.includes('<MPD')) pushStream(url, 'dash');
          } catch { /* ignore */ }
        }
      });
      return origSend.apply(this, args);
    };
  },
});
