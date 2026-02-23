// EXIF/XMP/IPTC binary parser for JPEG images

const TAGS: Record<number, string> = {
  0x010F: 'Make', 0x0110: 'Model', 0x0112: 'Orientation',
  0x011A: 'XResolution', 0x011B: 'YResolution', 0x0128: 'ResolutionUnit',
  0x0131: 'Software', 0x0132: 'DateTime', 0x013B: 'Artist', 0x8298: 'Copyright',
  0x829A: 'ExposureTime', 0x829D: 'FNumber', 0x8822: 'ExposureProgram',
  0x8827: 'ISOSpeedRatings', 0x9000: 'ExifVersion',
  0x9003: 'DateTimeOriginal', 0x9004: 'DateTimeDigitized',
  0x9201: 'ShutterSpeedValue', 0x9202: 'ApertureValue',
  0x9204: 'ExposureBiasValue', 0x9207: 'MeteringMode',
  0x9209: 'Flash', 0x920A: 'FocalLength',
  0xA001: 'ColorSpace', 0xA002: 'PixelXDimension', 0xA003: 'PixelYDimension',
  0xA405: 'FocalLengthIn35mmFilm', 0xA433: 'LensMake', 0xA434: 'LensModel',
  0x0001: 'GPSLatitudeRef', 0x0002: 'GPSLatitude',
  0x0003: 'GPSLongitudeRef', 0x0004: 'GPSLongitude',
  0x0005: 'GPSAltitudeRef', 0x0006: 'GPSAltitude',
};

const EXP_PROG: Record<number, string> = {
  0: 'Not defined', 1: 'Manual', 2: 'Normal program', 3: 'Aperture priority',
  4: 'Shutter priority', 5: 'Creative program', 6: 'Action program',
  7: 'Portrait mode', 8: 'Landscape mode',
};

const METER: Record<number, string> = {
  0: 'Unknown', 1: 'Average', 2: 'CenterWeighted', 3: 'Spot',
  4: 'MultiSpot', 5: 'Pattern', 6: 'Partial', 255: 'Other',
};

class Reader {
  private v: DataView;
  le = true;

  constructor(buf: ArrayBuffer) {
    this.v = new DataView(buf);
  }

  u8(o: number): number { return this.v.getUint8(o); }
  u16(o: number): number { return this.v.getUint16(o, this.le); }
  u32(o: number): number { return this.v.getUint32(o, this.le); }
  i32(o: number): number { return this.v.getInt32(o, this.le); }

  str(o: number, n: number): string {
    let s = '';
    for (let i = 0; i < n; i++) {
      const c = this.v.getUint8(o + i);
      if (!c) break;
      s += String.fromCharCode(c);
    }
    return s.trim();
  }

  rat(o: number): number {
    const n = this.u32(o), d = this.u32(o + 4);
    return d ? n / d : 0;
  }

  srat(o: number): number {
    const n = this.i32(o), d = this.i32(o + 4);
    return d ? n / d : 0;
  }
}

function readValue(r: Reader, t: number, c: number, vo: number, ts: number): any {
  switch (t) {
    case 1: return r.u8(vo);
    case 2: return c <= 4 ? r.str(vo, c) : r.str(ts + r.u32(vo), c);
    case 3: return r.u16(vo);
    case 4: return r.u32(vo);
    case 5: {
      const o = c * 8 <= 4 ? vo : ts + r.u32(vo);
      if (c === 1) return r.rat(o);
      const a = [];
      for (let i = 0; i < c; i++) a.push(r.rat(o + i * 8));
      return a;
    }
    case 7: return c <= 4 ? r.str(vo, c) : r.str(ts + r.u32(vo), c);
    case 10: {
      const o = c * 8 <= 4 ? vo : ts + r.u32(vo);
      if (c === 1) return r.srat(o);
      const a = [];
      for (let i = 0; i < c; i++) a.push(r.srat(o + i * 8));
      return a;
    }
    default: return null;
  }
}

function readIfd(r: Reader, off: number, ts: number): Record<string, any> {
  const tags: Record<string, any> = {};
  const cnt = r.u16(off);
  for (let i = 0; i < cnt; i++) {
    const e = off + 2 + i * 12;
    const tag = r.u16(e);
    const type = r.u16(e + 2);
    const c = r.u32(e + 4);
    const vo = e + 8;
    const name = TAGS[tag];
    if (name) tags[name] = readValue(r, type, c, vo, ts);
    if (tag === 0x8769) Object.assign(tags, readIfd(r, ts + r.u32(vo), ts));
    if (tag === 0x8825) Object.assign(tags, readIfd(r, ts + r.u32(vo), ts));
  }
  return tags;
}

function dmsToDecimal(a: number[], ref: string): number | null {
  if (!Array.isArray(a) || a.length < 3) return null;
  let d = a[0] + a[1] / 60 + a[2] / 3600;
  if (ref === 'S' || ref === 'W') d = -d;
  return Math.round(d * 1e6) / 1e6;
}

export interface ExifResult {
  raw: Record<string, any>;
  formatted: Record<string, string>;
  gps?: { lat: number; lng: number };
}

export function parseExif(buf: ArrayBuffer): ExifResult | null {
  const r = new Reader(buf);
  if (r.u8(0) !== 0xFF || r.u8(1) !== 0xD8) return null;

  let o = 2;
  while (o < buf.byteLength - 4) {
    if (r.u8(o) !== 0xFF) { o++; continue; }
    const m = r.u8(o + 1);
    if (m === 0xE1) break;
    if (m === 0xDA) return null;
    o += 2 + r.u16(o + 2);
  }

  if (r.str(o + 4, 4) !== 'Exif') return null;
  const ts = o + 10;
  r.le = r.u16(ts) === 0x4949;
  if (r.u16(ts + 2) !== 0x002A) return null;

  const raw = readIfd(r, ts + r.u32(ts + 4), ts);
  const f: Record<string, string> = {};

  if (raw.Make) f['카메라 제조사'] = raw.Make;
  if (raw.Model) f['카메라 모델'] = raw.Model;
  if (raw.LensMake) f['렌즈 제조사'] = raw.LensMake;
  if (raw.LensModel) f['렌즈 모델'] = raw.LensModel;
  if (raw.DateTimeOriginal) f['촬영 일시'] = raw.DateTimeOriginal;
  else if (raw.DateTime) f['촬영 일시'] = raw.DateTime;
  if (raw.ExposureTime) f['셔터 속도'] = raw.ExposureTime >= 1 ? `${raw.ExposureTime}s` : `1/${Math.round(1 / raw.ExposureTime)}s`;
  if (raw.FNumber) f['조리개'] = `f/${raw.FNumber}`;
  if (raw.ISOSpeedRatings) f['ISO'] = String(raw.ISOSpeedRatings);
  if (raw.FocalLength) f['초점 거리'] = `${raw.FocalLength}mm`;
  if (raw.FocalLengthIn35mmFilm) f['35mm 환산'] = `${raw.FocalLengthIn35mmFilm}mm`;
  if (raw.ExposureBiasValue != null) f['노출 보정'] = `${raw.ExposureBiasValue > 0 ? '+' : ''}${raw.ExposureBiasValue} EV`;
  if (raw.ExposureProgram != null) f['노출 모드'] = EXP_PROG[raw.ExposureProgram] || 'Unknown';
  if (raw.MeteringMode != null) f['측광 모드'] = METER[raw.MeteringMode] || 'Unknown';
  if (raw.Flash != null) f['플래시'] = raw.Flash & 1 ? '사용' : '미사용';
  if (raw.ColorSpace != null) f['색 공간'] = raw.ColorSpace === 1 ? 'sRGB' : 'Uncalibrated';
  if (raw.PixelXDimension && raw.PixelYDimension) f['원본 크기'] = `${raw.PixelXDimension} x ${raw.PixelYDimension}`;
  if (raw.Software) f['소프트웨어'] = raw.Software;
  if (raw.Artist) f['작가'] = raw.Artist;
  if (raw.Copyright) f['저작권'] = raw.Copyright;

  const res: ExifResult = { raw, formatted: f };

  if (raw.GPSLatitude && raw.GPSLongitude) {
    const lat = dmsToDecimal(raw.GPSLatitude, raw.GPSLatitudeRef);
    const lng = dmsToDecimal(raw.GPSLongitude, raw.GPSLongitudeRef);
    if (lat !== null && lng !== null) {
      f['GPS 위치'] = `${lat}, ${lng}`;
      res.gps = { lat, lng };
    }
  }

  if (raw.GPSAltitude != null) {
    f['고도'] = `${Math.round(raw.GPSAltitude * 10) / 10}m (${raw.GPSAltitudeRef === 1 ? '해수면 아래' : '해수면 위'})`;
  }

  return res;
}
