// ── EXIF Parser ──

const ExifParser = (() => {
  const TAGS = {
    0x010F:'Make',0x0110:'Model',0x0112:'Orientation',
    0x011A:'XResolution',0x011B:'YResolution',0x0128:'ResolutionUnit',
    0x0131:'Software',0x0132:'DateTime',0x013B:'Artist',0x8298:'Copyright',
    0x829A:'ExposureTime',0x829D:'FNumber',0x8822:'ExposureProgram',
    0x8827:'ISOSpeedRatings',0x9000:'ExifVersion',
    0x9003:'DateTimeOriginal',0x9004:'DateTimeDigitized',
    0x9201:'ShutterSpeedValue',0x9202:'ApertureValue',
    0x9204:'ExposureBiasValue',0x9207:'MeteringMode',
    0x9209:'Flash',0x920A:'FocalLength',
    0xA001:'ColorSpace',0xA002:'PixelXDimension',0xA003:'PixelYDimension',
    0xA405:'FocalLengthIn35mmFilm',0xA433:'LensMake',0xA434:'LensModel',
    0x0001:'GPSLatitudeRef',0x0002:'GPSLatitude',
    0x0003:'GPSLongitudeRef',0x0004:'GPSLongitude',
    0x0005:'GPSAltitudeRef',0x0006:'GPSAltitude',
  };
  const EXP_PROG = {0:'Not defined',1:'Manual',2:'Normal program',3:'Aperture priority',4:'Shutter priority',5:'Creative program',6:'Action program',7:'Portrait mode',8:'Landscape mode'};
  const METER = {0:'Unknown',1:'Average',2:'CenterWeighted',3:'Spot',4:'MultiSpot',5:'Pattern',6:'Partial',255:'Other'};

  class R {
    constructor(buf){this.v=new DataView(buf);this.le=true;}
    u8(o){return this.v.getUint8(o);}
    u16(o){return this.v.getUint16(o,this.le);}
    u32(o){return this.v.getUint32(o,this.le);}
    i32(o){return this.v.getInt32(o,this.le);}
    str(o,n){let s='';for(let i=0;i<n;i++){const c=this.v.getUint8(o+i);if(!c)break;s+=String.fromCharCode(c);}return s.trim();}
    rat(o){const n=this.u32(o),d=this.u32(o+4);return d?n/d:0;}
    srat(o){const n=this.i32(o),d=this.i32(o+4);return d?n/d:0;}
  }

  function val(r,t,c,vo,ts){
    switch(t){
      case 1:return r.u8(vo);
      case 2:return c<=4?r.str(vo,c):r.str(ts+r.u32(vo),c);
      case 3:return r.u16(vo);
      case 4:return r.u32(vo);
      case 5:{const o=c*8<=4?vo:ts+r.u32(vo);if(c===1)return r.rat(o);const a=[];for(let i=0;i<c;i++)a.push(r.rat(o+i*8));return a;}
      case 7:return c<=4?r.str(vo,c):r.str(ts+r.u32(vo),c);
      case 10:{const o=c*8<=4?vo:ts+r.u32(vo);if(c===1)return r.srat(o);const a=[];for(let i=0;i<c;i++)a.push(r.srat(o+i*8));return a;}
      default:return null;
    }
  }

  function ifd(r,off,ts){
    const tags={},cnt=r.u16(off);
    for(let i=0;i<cnt;i++){
      const e=off+2+i*12,tag=r.u16(e),type=r.u16(e+2),c=r.u32(e+4),vo=e+8;
      const name=TAGS[tag];if(name)tags[name]=val(r,type,c,vo,ts);
      if(tag===0x8769)Object.assign(tags,ifd(r,ts+r.u32(vo),ts));
      if(tag===0x8825)Object.assign(tags,ifd(r,ts+r.u32(vo),ts));
    }
    return tags;
  }

  function dms(a,ref){if(!Array.isArray(a)||a.length<3)return null;let d=a[0]+a[1]/60+a[2]/3600;if(ref==='S'||ref==='W')d=-d;return Math.round(d*1e6)/1e6;}

  function parse(buf){
    const r=new R(buf);
    if(r.u8(0)!==0xFF||r.u8(1)!==0xD8)return null;
    let o=2;
    while(o<buf.byteLength-4){
      if(r.u8(o)!==0xFF){o++;continue;}
      const m=r.u8(o+1);
      if(m===0xE1)break;
      if(m===0xDA)return null;
      o+=2+r.u16(o+2);
    }
    if(r.str(o+4,4)!=='Exif')return null;
    const ts=o+10;
    r.le=r.u16(ts)===0x4949;
    if(r.u16(ts+2)!==0x002A)return null;
    const raw=ifd(r,ts+r.u32(ts+4),ts);
    const f={};
    if(raw.Make)f['카메라 제조사']=raw.Make;
    if(raw.Model)f['카메라 모델']=raw.Model;
    if(raw.LensMake)f['렌즈 제조사']=raw.LensMake;
    if(raw.LensModel)f['렌즈 모델']=raw.LensModel;
    if(raw.DateTimeOriginal)f['촬영 일시']=raw.DateTimeOriginal;
    else if(raw.DateTime)f['촬영 일시']=raw.DateTime;
    if(raw.ExposureTime)f['셔터 속도']=raw.ExposureTime>=1?`${raw.ExposureTime}s`:`1/${Math.round(1/raw.ExposureTime)}s`;
    if(raw.FNumber)f['조리개']=`f/${raw.FNumber}`;
    if(raw.ISOSpeedRatings)f['ISO']=raw.ISOSpeedRatings;
    if(raw.FocalLength)f['초점 거리']=`${raw.FocalLength}mm`;
    if(raw.FocalLengthIn35mmFilm)f['35mm 환산']=`${raw.FocalLengthIn35mmFilm}mm`;
    if(raw.ExposureBiasValue!=null)f['노출 보정']=`${raw.ExposureBiasValue>0?'+':''}${raw.ExposureBiasValue} EV`;
    if(raw.ExposureProgram!=null)f['노출 모드']=EXP_PROG[raw.ExposureProgram]||'Unknown';
    if(raw.MeteringMode!=null)f['측광 모드']=METER[raw.MeteringMode]||'Unknown';
    if(raw.Flash!=null)f['플래시']=raw.Flash&1?'사용':'미사용';
    if(raw.ColorSpace!=null)f['색 공간']=raw.ColorSpace===1?'sRGB':'Uncalibrated';
    if(raw.PixelXDimension&&raw.PixelYDimension)f['원본 크기']=`${raw.PixelXDimension} x ${raw.PixelYDimension}`;
    if(raw.Software)f['소프트웨어']=raw.Software;
    if(raw.Artist)f['작가']=raw.Artist;
    if(raw.Copyright)f['저작권']=raw.Copyright;
    const res={raw,formatted:f};
    if(raw.GPSLatitude&&raw.GPSLongitude){
      const lat=dms(raw.GPSLatitude,raw.GPSLatitudeRef),lng=dms(raw.GPSLongitude,raw.GPSLongitudeRef);
      if(lat!==null&&lng!==null){f['GPS 위치']=`${lat}, ${lng}`;res.gps={lat,lng};}
    }
    if(raw.GPSAltitude!=null)f['고도']=`${Math.round(raw.GPSAltitude*10)/10}m (${raw.GPSAltitudeRef===1?'해수면 아래':'해수면 위'})`;
    return res;
  }
  return {parse};
})();

// ── AI Detection ──

const AIDetector = (() => {
  // Known AI tool patterns in Software/CreatorTool fields
  const AI_TOOLS = [
    { pattern: /midjourney/i, name: 'Midjourney' },
    { pattern: /dall[·\-\s]?e/i, name: 'DALL-E' },
    { pattern: /stable\s*diffusion/i, name: 'Stable Diffusion' },
    { pattern: /firefly/i, name: 'Adobe Firefly' },
    { pattern: /imagen/i, name: 'Google Imagen' },
    { pattern: /ideogram/i, name: 'Ideogram' },
    { pattern: /leonardo[\.\s]?ai/i, name: 'Leonardo AI' },
    { pattern: /playground\s*ai/i, name: 'Playground AI' },
    { pattern: /comfyui/i, name: 'ComfyUI' },
    { pattern: /automatic1111|a1111/i, name: 'AUTOMATIC1111' },
    { pattern: /invoke[\s-]?ai/i, name: 'InvokeAI' },
    { pattern: /novelai/i, name: 'NovelAI' },
    { pattern: /flux[\s._]?(dev|pro|schnell)/i, name: 'FLUX' },
    { pattern: /bing\s*image\s*creator/i, name: 'Bing Image Creator' },
    { pattern: /copilot/i, name: 'Microsoft Copilot' },
    { pattern: /gemini/i, name: 'Google Gemini' },
    { pattern: /canva\s*(ai|text\s*to\s*image)/i, name: 'Canva AI' },
    { pattern: /adobe\s*generative/i, name: 'Adobe Generative AI' },
    { pattern: /dream\s*studio/i, name: 'DreamStudio' },
    { pattern: /civitai/i, name: 'CivitAI' },
  ];

  // Extract XMP from JPEG (APP1 with XMP namespace)
  function extractXmpJpeg(buf) {
    const u8 = new Uint8Array(buf);
    const xmpNs = 'http://ns.adobe.com/xap/1.0/\0';
    let o = 2;
    while (o < u8.length - 4) {
      if (u8[o] !== 0xFF) { o++; continue; }
      const marker = u8[o + 1];
      if (marker === 0xDA) break; // SOS
      const len = (u8[o + 2] << 8) | u8[o + 3];
      if (marker === 0xE1) { // APP1
        const seg = new TextDecoder('utf-8', { fatal: false })
          .decode(u8.slice(o + 4, o + 4 + Math.min(len, 29)));
        if (seg.startsWith('http://ns.adobe.com/xap/1.0/')) {
          const xmpStart = o + 4 + 29;
          const xmpEnd = o + 2 + len;
          return new TextDecoder().decode(u8.slice(xmpStart, xmpEnd));
        }
      }
      o += 2 + len;
    }
    return null;
  }

  // Extract XMP from PNG (iTXt chunk with XML:com.adobe.xmp)
  function extractXmpPng(buf) {
    const u8 = new Uint8Array(buf);
    let o = 8; // skip PNG signature
    while (o < u8.length - 8) {
      const len = (u8[o] << 24) | (u8[o+1] << 16) | (u8[o+2] << 8) | u8[o+3];
      const type = String.fromCharCode(u8[o+4], u8[o+5], u8[o+6], u8[o+7]);
      if (type === 'iTXt') {
        const data = new TextDecoder('utf-8', { fatal: false })
          .decode(u8.slice(o + 8, o + 8 + Math.min(len, 100)));
        if (data.startsWith('XML:com.adobe.xmp')) {
          // keyword + null + compression flag + compression method + language + null + translated keyword + null + text
          let pos = o + 8;
          // Skip keyword (null terminated)
          while (pos < o + 8 + len && u8[pos] !== 0) pos++;
          pos++; // null
          pos++; // compression flag
          pos++; // compression method
          // Skip language tag (null terminated)
          while (pos < o + 8 + len && u8[pos] !== 0) pos++;
          pos++; // null
          // Skip translated keyword (null terminated)
          while (pos < o + 8 + len && u8[pos] !== 0) pos++;
          pos++; // null
          return new TextDecoder().decode(u8.slice(pos, o + 8 + len));
        }
      }
      if (type === 'IEND') break;
      o += 12 + len; // 4 len + 4 type + data + 4 crc
    }
    return null;
  }

  // Extract PNG tEXt chunks (key=value metadata, used by some AI tools)
  function extractPngText(buf) {
    const u8 = new Uint8Array(buf);
    const entries = {};
    let o = 8;
    while (o < u8.length - 8) {
      const len = (u8[o] << 24) | (u8[o+1] << 16) | (u8[o+2] << 8) | u8[o+3];
      const type = String.fromCharCode(u8[o+4], u8[o+5], u8[o+6], u8[o+7]);
      if (type === 'tEXt') {
        const raw = new TextDecoder('latin1').decode(u8.slice(o + 8, o + 8 + len));
        const sep = raw.indexOf('\0');
        if (sep > 0) entries[raw.substring(0, sep)] = raw.substring(sep + 1);
      }
      if (type === 'IEND') break;
      o += 12 + len;
    }
    return entries;
  }

  // Detect C2PA JUMBF boxes in JPEG (APP11 = 0xFFEB)
  function detectC2paJpeg(buf) {
    const u8 = new Uint8Array(buf);
    let o = 2;
    while (o < u8.length - 4) {
      if (u8[o] !== 0xFF) { o++; continue; }
      const marker = u8[o + 1];
      if (marker === 0xDA) break;
      const len = (u8[o + 2] << 8) | u8[o + 3];
      if (marker === 0xEB) { // APP11
        // Look for JUMBF "jumb"/"c2pa" markers in segment
        const seg = new TextDecoder('ascii', { fatal: false })
          .decode(u8.slice(o + 4, o + 4 + Math.min(len, 200)));
        if (seg.includes('jumb') || seg.includes('c2pa') || seg.includes('c2ma')) {
          // Try to extract claim_generator string
          const full = new TextDecoder('ascii', { fatal: false })
            .decode(u8.slice(o + 4, o + 2 + len));
          const genMatch = full.match(/claim_generator[":\s]+["']?([^"'\x00]{3,80})/);
          return { found: true, claimGenerator: genMatch ? genMatch[1].trim() : null };
        }
      }
      o += 2 + len;
    }
    return { found: false };
  }

  // Detect C2PA in PNG (caBX chunk)
  function detectC2paPng(buf) {
    const u8 = new Uint8Array(buf);
    let o = 8;
    while (o < u8.length - 8) {
      const len = (u8[o] << 24) | (u8[o+1] << 16) | (u8[o+2] << 8) | u8[o+3];
      const type = String.fromCharCode(u8[o+4], u8[o+5], u8[o+6], u8[o+7]);
      if (type === 'caBX' || type === 'caMs') {
        const seg = new TextDecoder('ascii', { fatal: false })
          .decode(u8.slice(o + 8, o + 8 + Math.min(len, 500)));
        const genMatch = seg.match(/claim_generator[":\s]+["']?([^"'\x00]{3,80})/);
        return { found: true, claimGenerator: genMatch ? genMatch[1].trim() : null };
      }
      if (type === 'IEND') break;
      o += 12 + len;
    }
    return { found: false };
  }

  // Analyze XMP for AI indicators
  function analyzeXmp(xmp) {
    if (!xmp) return null;
    const result = { tool: null, digitalSourceType: null, raw: {} };

    // DigitalSourceType (IPTC standard)
    const dstMatch = xmp.match(/DigitalSourceType[^>]*>([^<]+)</i)
      || xmp.match(/digitalsourcetype\/(\w+)/i);
    if (dstMatch) {
      result.digitalSourceType = dstMatch[1].trim();
      result.raw['DigitalSourceType'] = result.digitalSourceType;
    }

    // CreatorTool
    const ctMatch = xmp.match(/CreatorTool[^>]*>([^<]+)</i)
      || xmp.match(/CreatorTool=["']([^"']+)/i);
    if (ctMatch) {
      result.raw['CreatorTool'] = ctMatch[1].trim();
      for (const t of AI_TOOLS) {
        if (t.pattern.test(ctMatch[1])) { result.tool = t.name; break; }
      }
    }

    // History:SoftwareAgent (Adobe)
    const swAgents = [...xmp.matchAll(/softwareAgent=["']([^"']+)/gi)];
    for (const m of swAgents) {
      result.raw['SoftwareAgent'] = (result.raw['SoftwareAgent'] || '') + m[1] + '; ';
      for (const t of AI_TOOLS) {
        if (t.pattern.test(m[1])) { result.tool = result.tool || t.name; break; }
      }
    }

    // Description containing AI hints
    const descMatch = xmp.match(/description[^>]*>([^<]{0,500})/i);
    if (descMatch) {
      const desc = descMatch[1];
      if (/\b(generated|created)\s*(by|with|using)\s*(ai|artificial|machine|neural)/i.test(desc)) {
        result.raw['AI Description'] = desc.trim();
      }
    }

    // AI-specific XMP namespaces
    if (xmp.includes('ai_generated') || xmp.includes('AIGenerated') || xmp.includes('ai:generative')) {
      result.raw['AI Flag'] = 'true';
    }

    return result;
  }

  function analyze(buf, contentType, exifRaw) {
    const results = { isAI: false, confidence: 'none', signals: [], tool: null, c2pa: null };

    const isJpeg = buf.byteLength >= 2 &&
      new Uint8Array(buf)[0] === 0xFF && new Uint8Array(buf)[1] === 0xD8;
    const isPng = buf.byteLength >= 4 &&
      new Uint8Array(buf)[0] === 0x89 && new Uint8Array(buf)[1] === 0x50;
    const isWebp = buf.byteLength >= 12 &&
      new Uint8Array(buf)[0] === 0x52 && new Uint8Array(buf)[1] === 0x49;

    // 1) EXIF Software field
    if (exifRaw?.Software) {
      for (const t of AI_TOOLS) {
        if (t.pattern.test(exifRaw.Software)) {
          results.signals.push({ type: 'exif', field: 'Software', value: exifRaw.Software, tool: t.name });
          results.tool = t.name;
          break;
        }
      }
    }

    // 2) XMP metadata
    let xmp = null;
    if (isJpeg) xmp = extractXmpJpeg(buf);
    else if (isPng) xmp = extractXmpPng(buf);

    if (xmp) {
      const xmpResult = analyzeXmp(xmp);
      if (xmpResult) {
        if (xmpResult.tool) {
          results.tool = results.tool || xmpResult.tool;
          results.signals.push({ type: 'xmp', field: 'CreatorTool', value: xmpResult.raw['CreatorTool'], tool: xmpResult.tool });
        }
        if (xmpResult.digitalSourceType) {
          const dst = xmpResult.digitalSourceType;
          const isAiDst = /trainedAlgorithmicMedia|algorithmicMedia|composite.*synthetic/i.test(dst);
          results.signals.push({ type: 'iptc', field: 'DigitalSourceType', value: dst, isAI: isAiDst });
        }
        for (const [k, v] of Object.entries(xmpResult.raw)) {
          if (k === 'AI Flag') {
            results.signals.push({ type: 'xmp', field: 'AI Flag', value: 'true', isAI: true });
          }
        }
      }
    }

    // 3) PNG tEXt chunks (Stable Diffusion, ComfyUI, NovelAI, etc.)
    if (isPng) {
      const pngText = extractPngText(buf);
      const aiKeys = ['parameters', 'prompt', 'negative_prompt', 'Comment', 'Dream', 'sd-metadata'];
      for (const key of aiKeys) {
        if (pngText[key]) {
          results.signals.push({ type: 'png_text', field: key, value: pngText[key].substring(0, 200), isAI: true });
          // Try to identify the tool
          if (!results.tool) {
            if (pngText[key].includes('Steps:') && pngText[key].includes('Sampler:')) results.tool = 'Stable Diffusion';
            else if (pngText[key].includes('comfyui')) results.tool = 'ComfyUI';
            else if (pngText[key].includes('novelai')) results.tool = 'NovelAI';
          }
        }
      }
      if (pngText['Software']) {
        for (const t of AI_TOOLS) {
          if (t.pattern.test(pngText['Software'])) {
            results.signals.push({ type: 'png_text', field: 'Software', value: pngText['Software'], tool: t.name });
            results.tool = results.tool || t.name;
            break;
          }
        }
      }
      if (pngText['Source'] && /ai|generated|diffusion/i.test(pngText['Source'])) {
        results.signals.push({ type: 'png_text', field: 'Source', value: pngText['Source'], isAI: true });
      }
    }

    // 4) C2PA Content Credentials
    let c2pa = { found: false };
    if (isJpeg) c2pa = detectC2paJpeg(buf);
    else if (isPng) c2pa = detectC2paPng(buf);
    if (c2pa.found) {
      results.c2pa = c2pa;
      results.signals.push({ type: 'c2pa', field: 'Content Credentials', value: c2pa.claimGenerator || '존재', isAI: false });
      // C2PA itself doesn't mean AI — check claimGenerator
      if (c2pa.claimGenerator) {
        for (const t of AI_TOOLS) {
          if (t.pattern.test(c2pa.claimGenerator)) {
            results.tool = results.tool || t.name;
            results.signals[results.signals.length - 1].tool = t.name;
            results.signals[results.signals.length - 1].isAI = true;
            break;
          }
        }
      }
    }

    // Determine overall verdict
    const aiSignals = results.signals.filter(s => s.isAI || s.tool);
    if (aiSignals.length >= 2) {
      results.isAI = true;
      results.confidence = 'high';
    } else if (aiSignals.length === 1) {
      results.isAI = true;
      results.confidence = 'medium';
    } else if (results.tool) {
      results.isAI = true;
      results.confidence = 'low';
    }

    return results;
  }

  return { analyze };
})();

// ── State ──

let panelPort = null;

function sendToPanel(msg) {
  if (panelPort) {
    try { panelPort.postMessage(msg); } catch(e) { /* panel closed */ }
  }
}

// ── Side Panel Connection ──

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'sidepanel') return;
  panelPort = port;
  activateAllTabs();

  port.onMessage.addListener((msg) => {
    if (msg.action === 'downloadImage') {
      chrome.downloads.download({ url: msg.url, filename: msg.filename || undefined, saveAs: true });
    }
    if (msg.action === 'refetchImage') {
      processImage(msg.src, null);
    }
  });

  port.onDisconnect.addListener(() => {
    panelPort = null;
    deactivateAllTabs();
  });
});

function activateAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    for (const t of tabs) {
      if (t.id) chrome.tabs.sendMessage(t.id, { action: 'activateInspector' }).catch(() => {});
    }
  });
}

function deactivateAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    for (const t of tabs) {
      if (t.id) chrome.tabs.sendMessage(t.id, { action: 'deactivateInspector' }).catch(() => {});
    }
  });
}

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'complete' && panelPort) {
    chrome.tabs.sendMessage(tabId, { action: 'activateInspector' }).catch(() => {});
  }
});

// ── Context Menu ──

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'devlens-inspect',
    title: 'DevLens: 이미지 정보 보기',
    contexts: ['image'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'devlens-inspect') {
    await chrome.sidePanel.open({ tabId: tab.id });
    setTimeout(() => processImage(info.srcUrl, null), 500);
  }
});

// ── Content Script Messages ──

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'imageSelected') {
    processImage(msg.src, msg.pageInfo || null);
  }
  if (msg.action === 'videoSelected') {
    processVideo(msg.videoInfo);
  }
  if (msg.action === 'contentReady' && panelPort) {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) chrome.tabs.sendMessage(tab.id, { action: 'activateInspector' }).catch(() => {});
    });
  }
  // Offscreen messages
  if (msg.action === 'videoProgress') {
    sendToPanel({ action: 'videoProgress', stage: msg.stage, percent: msg.percent, message: msg.message });
  }
  if (msg.action === 'saveVideoBlob') {
    chrome.downloads.download({ url: msg.url, filename: msg.filename, saveAs: true });
  }
  if (msg.action === 'heartbeat') {
    // Keep-alive from offscreen doc — no-op, just resets SW timer
  }
  // Panel requests
  if (msg.action === 'startVideoDownload') {
    startVideoDownload(msg.videoData);
  }
});

// ── Download Path Notification ──

chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state && delta.state.current === 'complete') {
    chrome.downloads.search({ id: delta.id }, (results) => {
      if (results && results[0] && results[0].filename) {
        sendToPanel({ action: 'downloadComplete', path: results[0].filename });
      }
    });
  }
});

// ── Process Image ──

async function processImage(url, pageInfo) {
  sendToPanel({ action: 'imageLoading', src: url });

  // Get the active tab's URL to use as Referer in cURL generation
  let pageUrl = null;
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && activeTab.url) pageUrl = activeTab.url;
  } catch (_) { /* ignore */ }

  try {
    // Include credentials (cookies) — some CDNs/servers require auth and return JSON errors without them
    let response = await fetch(url, { credentials: 'include' });

    // If non-image response, retry without credentials (CORS may block credentialed requests)
    const ct = response.headers.get('content-type') || '';
    if (!ct.includes('image') && !ct.includes('octet-stream')) {
      try {
        response = await fetch(url, { credentials: 'omit' });
      } catch {}
    }

    // ── Access analysis ──
    // 1) Check URL for auth params (sig in URL = signed URL, auth is embedded)
    // 2) Check domain cookies for auth cookies
    // 3) Strip auth params and test if URL works without them
    const u = new URL(url);
    const urlAuthParamNames = ['sig', 'signature', 'token', 'auth', 'hmac',
      'access_token', 'api_key', 'apikey', 'key',
      'X-Amz-Signature', 'X-Amz-Credential', 'X-Amz-Date', 'X-Amz-Expires',
      'X-Amz-Algorithm', 'X-Amz-Security-Token',
      'X-Goog-Signature', 'X-Goog-Credential', 'X-Goog-Date', 'X-Goog-Expires'];
    const foundAuthParams = [];
    for (const name of urlAuthParamNames) {
      // case-insensitive match
      for (const [k, v] of u.searchParams.entries()) {
        if (k.toLowerCase() === name.toLowerCase() && v) {
          foundAuthParams.push(k);
        }
      }
    }

    let cookieInfo = { authCookies: [], totalCookies: 0 };
    try {
      const cookies = await chrome.cookies.getAll({ url: u.origin });
      const authPattern = /auth|session|token|jwt|sid|login|user|credential|connect\.sid|PHPSESSID|_csrf/i;
      cookieInfo = {
        authCookies: cookies.filter(c => authPattern.test(c.name)).map(c => c.name),
        totalCookies: cookies.length,
      };
    } catch {}

    const hasSigned = foundAuthParams.length > 0;
    let needsCookie = false;

    // Always test — fetch without cookies, check if real image comes back
    try {
      const testResp = await fetch(url, { credentials: 'omit', cache: 'no-store' });
      if (!testResp.ok) {
        needsCookie = true;
      } else {
        const testCt = testResp.headers.get('content-type') || '';
        if (!testCt.includes('image') && !testCt.includes('octet-stream')) {
          needsCookie = true;
        } else {
          const reader = testResp.body.getReader();
          const { value } = await reader.read();
          reader.cancel();
          if (!value || value.length < 2) {
            needsCookie = true;
          } else {
            const b0 = value[0], b1 = value[1];
            const isImage = (
              (b0 === 0xFF && b1 === 0xD8) || // JPEG
              (b0 === 0x89 && b1 === 0x50) || // PNG
              (b0 === 0x47 && b1 === 0x49) || // GIF
              (b0 === 0x52 && b1 === 0x49) || // WEBP (RIFF)
              (b0 === 0x42 && b1 === 0x4D) || // BMP
              (b0 === 0x3C)                    // SVG (<)
            );
            if (!isImage) needsCookie = true;
          }
        }
      }
    } catch {
      needsCookie = true;
    }

    let credentialMode = 'none';
    if (hasSigned && needsCookie) credentialMode = 'signed+cookie';
    else if (hasSigned) credentialMode = 'signed';
    else if (needsCookie) credentialMode = 'cookie';

    // Collect ALL response headers
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const contentType = headers['content-type'] || '';
    const buffer = await response.arrayBuffer();

    let exif = null;
    const isJpeg = buffer.byteLength >= 2 &&
      new DataView(buffer).getUint8(0) === 0xFF &&
      new DataView(buffer).getUint8(1) === 0xD8;

    if (contentType.includes('jpeg') || contentType.includes('jpg') || isJpeg) {
      try { exif = ExifParser.parse(buffer); } catch(e) { /* parse error */ }
    }

    // AI detection
    let aiInfo = null;
    try {
      aiInfo = AIDetector.analyze(buffer, contentType, exif?.raw || null);
    } catch {}

    // Generate thumbnail data URL (so sidepanel can display auth-required images)
    // Only for images under 5MB to avoid message size issues
    let thumbDataUrl = '';
    if (buffer.byteLength < 5 * 1024 * 1024) {
      try {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        thumbDataUrl = `data:${contentType || 'image/png'};base64,${btoa(binary)}`;
      } catch {}
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
        aiInfo,
        status: response.status,
        statusText: response.statusText,
        credentialMode,
        cookieInfo,
        urlAuthParams: foundAuthParams,
      },
    });

    // Auto-save after sending data to panel
    await tryAutoSave(url, contentType);
  } catch (err) {
    sendToPanel({ action: 'imageError', src: url, error: err.message });
  }
}

// ── Process Video ──

async function processVideo(videoInfo) {
  sendToPanel({ action: 'videoLoading' });

  let pageUrl = null;
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.url) pageUrl = activeTab.url;
  } catch {}

  const data = {
    ...videoInfo,
    pageUrl,
    durationFormatted: formatDuration(videoInfo.duration),
  };

  // If it's an HLS stream, try to fetch the manifest for info
  if (videoInfo.streamUrl && videoInfo.streamType === 'hls') {
    try {
      const resp = await fetch(videoInfo.streamUrl);
      const text = await resp.text();
      const headers = {};
      resp.headers.forEach((v, k) => { headers[k] = v; });
      data.manifestContent = text;
      data.headers = headers;
      data.segmentCount = text.split('\n').filter(l => l.trim() && !l.startsWith('#')).length;
    } catch {}
  }

  // If direct video URL, try HEAD to get size/headers
  if (!videoInfo.isBlob && videoInfo.src) {
    try {
      const resp = await fetch(videoInfo.src, { method: 'HEAD' });
      const headers = {};
      resp.headers.forEach((v, k) => { headers[k] = v; });
      data.headers = headers;
      data.fileSize = parseInt(headers['content-length'] || '0');
    } catch {}
  }

  sendToPanel({ action: 'videoData', data });
}

function formatDuration(sec) {
  if (!sec || !isFinite(sec)) return 'N/A';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Video Download ──

let offscreenReady = false;

async function ensureOffscreen() {
  if (offscreenReady) return;
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['BLOBS'],
      justification: 'Download and merge video segments',
    });
    offscreenReady = true;
  } catch (e) {
    // Already exists
    if (e.message.includes('already')) offscreenReady = true;
    else throw e;
  }
}

async function startVideoDownload(videoData) {
  sendToPanel({ action: 'videoProgress', stage: 'init', percent: 0, message: '다운로드 준비 중...' });

  try {
    await ensureOffscreen();

    if (videoData.streamUrl && videoData.streamType === 'hls') {
      const baseUrl = videoData.streamUrl.substring(0, videoData.streamUrl.lastIndexOf('/') + 1);
      chrome.runtime.sendMessage({
        action: 'downloadHLS',
        manifestUrl: videoData.streamUrl,
        baseUrl,
        filename: extractVideoFilename(videoData),
      });
    } else if (!videoData.isBlob && videoData.src) {
      chrome.runtime.sendMessage({
        action: 'downloadDirect',
        url: videoData.src,
        filename: extractVideoFilename(videoData),
      });
    } else {
      sendToPanel({ action: 'videoProgress', stage: 'error', percent: 0, message: '다운로드할 수 없는 소스입니다 (blob URL, 스트림 URL 미감지)' });
    }
  } catch (err) {
    sendToPanel({ action: 'videoProgress', stage: 'error', percent: 0, message: err.message });
  }
}

function extractVideoFilename(data) {
  if (data.streamUrl) {
    try {
      const name = new URL(data.streamUrl).pathname.split('/').pop();
      if (name) return name.replace(/\.m3u8.*$/, '').replace(/\.mpd.*$/, '') || 'video';
    } catch {}
  }
  if (data.src && !data.isBlob) {
    try {
      const name = new URL(data.src).pathname.split('/').pop();
      if (name) return name;
    } catch {}
  }
  return 'video';
}

// ── Network Sniffing for m3u8/mpd via webRequest ──

const detectedStreams = new Map(); // tabId -> [{url, type, timestamp}]

chrome.webRequest.onCompleted.addListener(
  (details) => {
    const url = details.url;
    if (url.includes('.m3u8') || url.includes('.mpd') ||
        (details.type === 'xmlhttprequest' && (url.includes('manifest') || url.includes('playlist')))) {
      const type = url.includes('.mpd') ? 'dash' : 'hls';
      const tabId = details.tabId;
      if (!detectedStreams.has(tabId)) detectedStreams.set(tabId, []);
      const streams = detectedStreams.get(tabId);
      if (!streams.find(s => s.url === url)) {
        streams.push({ url, type, timestamp: Date.now() });
        // Notify side panel
        sendToPanel({ action: 'streamDetected', url, type, tabId });
      }
    }
  },
  { urls: ['<all_urls>'] }
);

// Clean up on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  detectedStreams.delete(tabId);
});

// ── Auto-Save ──

async function tryAutoSave(url, contentType) {
  try {
    const result = await chrome.storage.local.get('devlensSettings');
    const settings = result.devlensSettings;
    if (!settings || !settings.autoSave) return;

    const prefix = settings.filePrefix || 'devlens_';
    const format = settings.saveFormat || 'original';

    // Extract original filename parts
    let baseName = 'image';
    let originalExt = '';
    try {
      const pathname = new URL(url).pathname;
      const filename = decodeURIComponent(pathname.split('/').pop() || '');
      if (filename && filename.includes('.')) {
        const dotIdx = filename.lastIndexOf('.');
        baseName = filename.substring(0, dotIdx);
        originalExt = filename.substring(dotIdx); // includes the dot
      } else if (filename) {
        baseName = filename;
      }
    } catch (_) { /* use defaults */ }

    // Determine file extension based on format setting
    let ext = originalExt;
    if (format === 'png') {
      ext = '.png';
    } else if (format === 'jpg') {
      ext = '.jpg';
    } else if (!ext) {
      // Fallback: derive extension from content-type
      const extMap = {
        'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
        'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/avif': '.avif',
        'image/bmp': '.bmp', 'image/tiff': '.tiff',
      };
      for (const [mime, e] of Object.entries(extMap)) {
        if (contentType && contentType.includes(mime)) { ext = e; break; }
      }
      if (!ext) ext = '.png'; // ultimate fallback
    }

    const downloadFilename = `${prefix}${baseName}${ext}`;

    // Determine the download URL — for format conversion, use an offscreen-friendly data URL approach
    let downloadUrl = url;
    if (format !== 'original' && contentType && !contentType.includes(format === 'png' ? 'png' : 'jpeg')) {
      // For format conversion, we re-fetch and convert via blob/createImageBitmap in the service worker
      try {
        const convertedUrl = await convertImageFormat(url, format);
        if (convertedUrl) downloadUrl = convertedUrl;
      } catch (_) { /* fallback to original URL */ }
    }

    chrome.downloads.download({
      url: downloadUrl,
      filename: downloadFilename,
      saveAs: false,
    });
  } catch (_) { /* auto-save failure should be silent */ }
}

async function convertImageFormat(url, format) {
  const response = await fetch(url, { credentials: 'include' });
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  const quality = format === 'jpg' ? 0.92 : undefined;
  const convertedBlob = await canvas.convertToBlob({ type: mimeType, quality });

  // Convert blob to data URL for chrome.downloads.download()
  const buffer = await convertedBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}
