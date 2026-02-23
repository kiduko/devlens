// Image data from background to sidepanel
export interface ImageData {
  src: string;
  thumbDataUrl: string;
  contentType: string;
  fileSize: number;
  headers: Record<string, string>;
  pageInfo: PageInfo | null;
  pageUrl: string | null;
  exif: ExifResult | null;
  status: number;
  statusText: string;
  credentialMode: 'none' | 'signed' | 'cookie' | 'signed+cookie';
  cookieInfo: CookieInfo;
  urlAuthParams: string[];
  error?: string;
}

export interface PageInfo {
  naturalWidth: number;
  naturalHeight: number;
  renderWidth: number;
  renderHeight: number;
  alt: string;
}

export interface ExifResult {
  raw: Record<string, any>;
  formatted: Record<string, string>;
  gps?: { lat: number; lng: number };
}

export interface CookieInfo {
  authCookies: string[];
  totalCookies: number;
}

// Video data
export interface VideoData {
  src: string;
  poster?: string;
  frameThumbnail?: string;
  duration: number;
  durationFormatted: string;
  videoWidth: number;
  videoHeight: number;
  renderWidth?: number;
  renderHeight?: number;
  isBlob: boolean;
  isMsBlob?: boolean;
  streamUrl?: string;
  streamType?: 'hls' | 'dash' | 'hls_base';
  manifestContent?: string;
  headers?: Record<string, string>;
  fileSize?: number;
  segmentCount?: number;
  pageUrl?: string;
  igUsername?: string;
  igShortcode?: string;
  directMedia?: DirectMedia[];
  captureInfo?: CaptureInfo;
}

export interface DirectMedia {
  url: string;
  mime: string;
  size?: number;
  itag?: string;
}

export interface CaptureInfo {
  totalSize: number;
  mimeTypes: string[];
}

// Video progress
export interface VideoProgress {
  stage: 'init' | 'downloading' | 'done' | 'error';
  percent: number;
  message: string;
}

// URL parameter analysis
export interface DetectedUrlParam {
  type: 'width' | 'height' | 'quality' | 'size' | 'dpr' | 'format' | 'preset' | 'fit';
  label: string;
  key: string | null;
  value: string | number;
  originalValue: string | number;
  source: 'query' | 'cloudinary' | 'google' | 'naver_path' | 'naver_query' | 'path_dim' | 'wordpress' | 'shopify';
  unit?: string;
  max?: number;
  presets?: string[] | null;
  hint?: string;
  rawTypeValue?: string;
  dimChar?: string;
  origDim?: string;
}

// Overlay badge data
export interface OverlayBadgeData {
  src: string;
  contentType: string;
  fileSize: number;
  credentialMode: 'none' | 'signed' | 'cookie' | 'signed+cookie';
  status: number;
  error?: string;
}

// Access analysis
export interface AccessItem {
  icon: string;
  label: string;
  desc: string;
  level: 'ok' | 'info' | 'warn' | 'error' | 'detail';
}

// Settings
export interface DevLensSettings {
  autoSave: boolean;
  filePrefix: string;
  saveFormat: 'original' | 'png' | 'jpg';
  enableHistory: boolean;
  enableOverlay: boolean;
  folderMode: 'none' | 'date' | 'site' | 'date-site' | 'site-date';
  rootFolder: string;
}

// Messages from background to sidepanel (via port)
export type DevLensMessage =
  | { action: 'imageLoading'; src: string }
  | { action: 'imageData'; data: ImageData }
  | { action: 'imageError'; src: string; error: string }
  | { action: 'videoLoading' }
  | { action: 'videoData'; data: VideoData }
  | { action: 'videoProgress'; stage: string; percent: number; message: string }
  | { action: 'streamDetected'; url: string; type: string; tabId: number }
  | { action: 'downloadComplete'; path: string };

// Messages from sidepanel to background (via port)
export type DevLensPanelMessage =
  | { action: 'downloadImage'; url: string; filename: string; saveAs: boolean }
  | { action: 'refetchImage'; src: string };

// Messages via chrome.runtime.sendMessage
export type DevLensRuntimeMessage =
  | { action: 'imageSelected'; src: string; pageInfo: PageInfo | null }
  | { action: 'videoSelected'; videoInfo: any }
  | { action: 'contentReady' }
  | { action: 'startVideoDownload'; videoData: VideoData }
  | { action: 'downloadCapture'; filename: string; blobUrl: string }
  | { action: 'captureDownloadDone' }
  | { action: 'captureDownloadError'; error: string }
  | { action: 'setAlwaysOnTop'; enabled: boolean }
  | { action: 'popOut' }
  | { action: 'activateInspector' }
  | { action: 'deactivateInspector' }
  | { action: 'videoProgress'; stage: string; percent: number; message: string }
  | { action: 'saveVideoBlob'; url: string; filename: string }
  | { action: 'heartbeat' }
  | { action: 'downloadHLS'; manifestUrl: string; baseUrl: string; filename: string }
  | { action: 'downloadDirect'; url: string; filename: string; expectedSize: number }
  | { action: 'overlayAnalyzeBatch'; items: { src: string; requestId: string }[] }
  | { action: 'overlayResultBatch'; results: { requestId: string; result: OverlayBadgeData }[] }
  | { action: 'activateOverlay' }
  | { action: 'deactivateOverlay' };

// Download record
export interface DownloadRecord {
  downloadId: number;
  sourceUrl: string;
  pageUrl: string;
  hostname: string;
  filename: string;
  contentType: string;
  fileSize: number;
  timestamp: number;
}

// History item
export interface HistoryItem {
  src: string;
}

// View states
export type ViewState = 'empty' | 'loading' | 'image' | 'video';
