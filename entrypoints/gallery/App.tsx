import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DownloadRecord } from '../../src/features/devlens/types';
import { formatFileSize } from '../../src/shared/utils/format';
import '../../src/features/devlens/gallery.css';

type ViewMode = 'grid' | 'list';
type SortBy = 'newest' | 'oldest' | 'largest' | 'site';

function formatDate(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function extractName(filepath: string): string {
  if (!filepath) return 'unknown';
  return filepath.split('/').pop() || filepath;
}

export default function GalleryApp() {
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1600);
  }, []);

  useEffect(() => {
    chrome.storage.local.get('devlensDownloads', (result) => {
      setDownloads(result.devlensDownloads || []);
    });
  }, []);

  const sites = useMemo(() =>
    [...new Set(downloads.map(d => d.hostname).filter(Boolean))].sort(),
    [downloads]
  );

  const filtered = useMemo(() => {
    let items = [...downloads];
    const q = search.toLowerCase().trim();
    if (q) {
      items = items.filter(d =>
        (d.filename || '').toLowerCase().includes(q) ||
        (d.hostname || '').toLowerCase().includes(q) ||
        (d.sourceUrl || '').toLowerCase().includes(q)
      );
    }
    if (filterDate) {
      items = items.filter(d => new Date(d.timestamp).toISOString().slice(0, 10) === filterDate);
    }
    if (filterSite) {
      items = items.filter(d => d.hostname === filterSite);
    }
    if (sortBy === 'newest') items.sort((a, b) => b.timestamp - a.timestamp);
    else if (sortBy === 'oldest') items.sort((a, b) => a.timestamp - b.timestamp);
    else if (sortBy === 'largest') items.sort((a, b) => (b.fileSize || 0) - (a.fileSize || 0));
    else if (sortBy === 'site') items.sort((a, b) => (a.hostname || '').localeCompare(b.hostname || '') || b.timestamp - a.timestamp);
    return items;
  }, [downloads, search, filterDate, filterSite, sortBy]);

  const showInFolder = (item: DownloadRecord) => {
    if (item.downloadId) chrome.downloads.show(item.downloadId);
    else toast('파일 위치를 열 수 없습니다');
  };

  const openSource = (item: DownloadRecord) => {
    if (item.sourceUrl) window.open(item.sourceUrl, '_blank');
    else if (item.pageUrl) window.open(item.pageUrl, '_blank');
  };

  const deleteItem = async (item: DownloadRecord) => {
    const result = await chrome.storage.local.get('devlensDownloads');
    const dl: DownloadRecord[] = result.devlensDownloads || [];
    const idx = dl.findIndex(d => d.downloadId === item.downloadId && d.timestamp === item.timestamp);
    if (idx !== -1) dl.splice(idx, 1);
    await chrome.storage.local.set({ devlensDownloads: dl });
    if (item.downloadId) {
      try { chrome.downloads.removeFile(item.downloadId); } catch { /* ignore */ }
    }
    setDownloads(dl);
    toast('삭제되었습니다');
  };

  const clearAll = async () => {
    if (!confirm('모든 다운로드 기록을 삭제하시겠습니까?')) return;
    await chrome.storage.local.set({ devlensDownloads: [] });
    setDownloads([]);
    toast('모든 기록이 삭제되었습니다');
  };

  return (
    <div className="gl-root">
      {/* Header */}
      <header className="gl-header">
        <div className="gl-header-left">
          <svg className="gl-header-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span className="gl-header-title">DevLens Gallery</span>
          <span className="gl-file-count">{filtered.length}</span>
        </div>
        <div className="gl-header-right">
          <input
            type="search"
            className="gl-search-input"
            placeholder="검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      {/* Toolbar */}
      <div className="gl-toolbar">
        <div className="gl-toolbar-left">
          <input type="date" className="gl-filter-date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          <select className="gl-filter-select" value={filterSite} onChange={(e) => setFilterSite(e.target.value)}>
            <option value="">모든 사이트</option>
            {sites.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="gl-filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
            <option value="newest">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="largest">큰 파일순</option>
            <option value="site">사이트별</option>
          </select>
        </div>
        <div className="gl-toolbar-right">
          <button className={`gl-view-btn${viewMode === 'grid' ? ' gl-active' : ''}`} title="그리드 뷰" onClick={() => setViewMode('grid')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
          </button>
          <button className={`gl-view-btn${viewMode === 'list' ? ' gl-active' : ''}`} title="리스트 뷰" onClick={() => setViewMode('list')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
          <button className="gl-clear-btn" onClick={clearAll}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
            삭제
          </button>
        </div>
      </div>

      {/* Gallery */}
      <main className="gl-gallery">
        {filtered.length === 0 ? (
          <div className="gl-empty-state">
            <div className="gl-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <p className="gl-empty-title">다운로드 기록이 없습니다</p>
            <p className="gl-empty-desc">DevLens로 이미지를 저장하면 여기에 표시됩니다</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="gl-grid">
            {filtered.map((item, i) => (
              <div key={`${item.downloadId}-${item.timestamp}-${i}`} className="gl-card">
                <ImageThumb src={item.sourceUrl} alt={item.filename} contentType={item.contentType} />
                <div className="gl-card-body">
                  <div className="gl-card-filename" title={item.filename}>{extractName(item.filename)}</div>
                  <div className="gl-card-meta">
                    {item.hostname && <span className="gl-card-site">{item.hostname}</span>}
                    <span>{formatDate(item.timestamp)}</span>
                    {item.fileSize > 0 && <span>{formatFileSize(item.fileSize)}</span>}
                  </div>
                </div>
                <div className="gl-card-actions">
                  <button className="gl-card-action" onClick={() => showInFolder(item)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                    <span>폴더</span>
                  </button>
                  <button className="gl-card-action" onClick={() => openSource(item)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    <span>원본</span>
                  </button>
                  <button className="gl-card-action gl-danger" onClick={() => deleteItem(item)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    <span>삭제</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="gl-list">
            {filtered.map((item, i) => (
              <div key={`${item.downloadId}-${item.timestamp}-${i}`} className="gl-list-item">
                <img className="gl-list-thumb" src={item.sourceUrl || ''} alt="" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.background = 'var(--bg-hover)'; }} />
                <div className="gl-list-info">
                  <div className="gl-list-filename" title={item.filename}>{extractName(item.filename)}</div>
                  <div className="gl-list-meta">
                    {[item.hostname, formatDate(item.timestamp), item.fileSize ? formatFileSize(item.fileSize) : ''].filter(Boolean).join(' \u00b7 ')}
                  </div>
                </div>
                <div className="gl-list-actions">
                  <button className="gl-list-action" title="파일 위치 열기" onClick={() => showInFolder(item)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                  </button>
                  <button className="gl-list-action" title="원본 URL 열기" onClick={() => openSource(item)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </button>
                  <button className="gl-list-action gl-danger" title="삭제" onClick={() => deleteItem(item)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {toastMsg && <div className="gl-toast">{toastMsg}</div>}
    </div>
  );
}

function ImageThumb({ src, alt, contentType }: { src: string; alt: string; contentType: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    const icon = !contentType ? '\uD83D\uDCC4'
      : contentType.includes('svg') ? '\uD83C\uDFA8'
      : contentType.includes('gif') ? '\uD83C\uDF1F'
      : '\uD83D\uDDBC\uFE0F';
    return <div className="gl-card-thumb gl-fallback">{icon}</div>;
  }

  return <img className="gl-card-thumb" src={src || ''} alt={alt || ''} loading="lazy" onError={() => setFailed(true)} />;
}
