const $ = (sel) => document.querySelector(sel);

let allDownloads = [];
let viewMode = 'grid'; // 'grid' | 'list'

// ── Load Data ──

async function loadDownloads() {
  const result = await chrome.storage.local.get('devlensDownloads');
  allDownloads = result.devlensDownloads || [];
  populateSiteFilter();
  renderGallery();
}

// ── Filters & Sort ──

function getFilteredDownloads() {
  let items = [...allDownloads];

  // Search
  const query = ($('#searchInput').value || '').toLowerCase().trim();
  if (query) {
    items = items.filter(d =>
      (d.filename || '').toLowerCase().includes(query) ||
      (d.hostname || '').toLowerCase().includes(query) ||
      (d.sourceUrl || '').toLowerCase().includes(query)
    );
  }

  // Date filter
  const dateVal = $('#filterDate').value;
  if (dateVal) {
    items = items.filter(d => {
      const day = new Date(d.timestamp).toISOString().slice(0, 10);
      return day === dateVal;
    });
  }

  // Site filter
  const siteVal = $('#filterSite').value;
  if (siteVal) {
    items = items.filter(d => d.hostname === siteVal);
  }

  // Sort
  const sortBy = $('#sortBy').value;
  if (sortBy === 'newest') items.sort((a, b) => b.timestamp - a.timestamp);
  else if (sortBy === 'oldest') items.sort((a, b) => a.timestamp - b.timestamp);
  else if (sortBy === 'largest') items.sort((a, b) => (b.fileSize || 0) - (a.fileSize || 0));
  else if (sortBy === 'site') items.sort((a, b) => (a.hostname || '').localeCompare(b.hostname || '') || b.timestamp - a.timestamp);

  return items;
}

function populateSiteFilter() {
  const sites = [...new Set(allDownloads.map(d => d.hostname).filter(Boolean))].sort();
  const select = $('#filterSite');
  const current = select.value;
  select.innerHTML = '<option value="">모든 사이트</option>';
  for (const site of sites) {
    const opt = document.createElement('option');
    opt.value = site;
    opt.textContent = site;
    select.appendChild(opt);
  }
  select.value = current;
}

// ── Render ──

function renderGallery() {
  const items = getFilteredDownloads();
  const gallery = $('#gallery');
  const emptyState = $('#emptyState');

  $('#fileCount').textContent = items.length;

  if (items.length === 0) {
    // Keep empty state, remove grid/list
    const existing = gallery.querySelector('.gallery-grid, .gallery-list');
    if (existing) existing.remove();
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  if (viewMode === 'grid') {
    renderGrid(items, gallery);
  } else {
    renderList(items, gallery);
  }
}

function renderGrid(items, gallery) {
  // Remove existing list
  const existing = gallery.querySelector('.gallery-grid, .gallery-list');
  if (existing) existing.remove();

  const grid = document.createElement('div');
  grid.className = 'gallery-grid';

  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'card';

    // Thumbnail
    const thumb = document.createElement('img');
    thumb.className = 'card-thumb';
    thumb.loading = 'lazy';
    thumb.src = item.sourceUrl || '';
    thumb.alt = item.filename || '';
    thumb.onerror = () => {
      thumb.remove();
      const fb = document.createElement('div');
      fb.className = 'card-thumb fallback';
      fb.textContent = getFileIcon(item.contentType);
      card.prepend(fb);
    };

    // Body
    const body = document.createElement('div');
    body.className = 'card-body';

    const fname = document.createElement('div');
    fname.className = 'card-filename';
    fname.textContent = extractName(item.filename);
    fname.title = item.filename || '';

    const meta = document.createElement('div');
    meta.className = 'card-meta';

    if (item.hostname) {
      const site = document.createElement('span');
      site.className = 'card-site';
      site.textContent = item.hostname;
      meta.appendChild(site);
    }

    const date = document.createElement('span');
    date.textContent = formatDate(item.timestamp);
    meta.appendChild(date);

    if (item.fileSize) {
      const size = document.createElement('span');
      size.textContent = formatFileSize(item.fileSize);
      meta.appendChild(size);
    }

    body.appendChild(fname);
    body.appendChild(meta);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'card-actions';

    actions.appendChild(createCardAction('폴더', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>', () => showInFolder(item)));
    actions.appendChild(createCardAction('원본', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>', () => openSource(item)));
    const delBtn = createCardAction('삭제', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>', () => deleteItem(item));
    delBtn.classList.add('danger');
    actions.appendChild(delBtn);

    card.appendChild(thumb);
    card.appendChild(body);
    card.appendChild(actions);
    grid.appendChild(card);
  }

  gallery.appendChild(grid);
}

function renderList(items, gallery) {
  const existing = gallery.querySelector('.gallery-grid, .gallery-list');
  if (existing) existing.remove();

  const list = document.createElement('div');
  list.className = 'gallery-list';

  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'list-item';

    const thumb = document.createElement('img');
    thumb.className = 'list-thumb';
    thumb.loading = 'lazy';
    thumb.src = item.sourceUrl || '';
    thumb.onerror = () => { thumb.src = ''; thumb.style.background = 'var(--bg-hover)'; };

    const info = document.createElement('div');
    info.className = 'list-info';

    const fname = document.createElement('div');
    fname.className = 'list-filename';
    fname.textContent = extractName(item.filename);
    fname.title = item.filename || '';

    const meta = document.createElement('div');
    meta.className = 'list-meta';
    const parts = [];
    if (item.hostname) parts.push(item.hostname);
    parts.push(formatDate(item.timestamp));
    if (item.fileSize) parts.push(formatFileSize(item.fileSize));
    meta.textContent = parts.join(' \u00b7 ');

    info.appendChild(fname);
    info.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'list-actions';
    actions.appendChild(createListAction('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>', '파일 위치 열기', () => showInFolder(item)));
    actions.appendChild(createListAction('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>', '원본 URL 열기', () => openSource(item)));
    const delBtn = createListAction('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>', '삭제', () => deleteItem(item));
    delBtn.classList.add('danger');
    actions.appendChild(delBtn);

    row.appendChild(thumb);
    row.appendChild(info);
    row.appendChild(actions);
    list.appendChild(row);
  }

  gallery.appendChild(list);
}

function createCardAction(label, svgHtml, onClick) {
  const btn = document.createElement('button');
  btn.className = 'card-action';
  btn.innerHTML = svgHtml + `<span>${label}</span>`;
  btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return btn;
}

function createListAction(svgHtml, title, onClick) {
  const btn = document.createElement('button');
  btn.className = 'list-action';
  btn.title = title;
  btn.innerHTML = svgHtml;
  btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return btn;
}

// ── Actions ──

function showInFolder(item) {
  if (item.downloadId) {
    chrome.downloads.show(item.downloadId);
  } else {
    toast('파일 위치를 열 수 없습니다');
  }
}

function openSource(item) {
  if (item.sourceUrl) {
    window.open(item.sourceUrl, '_blank');
  } else if (item.pageUrl) {
    window.open(item.pageUrl, '_blank');
  }
}

async function deleteItem(item) {
  // Remove from storage
  const result = await chrome.storage.local.get('devlensDownloads');
  const downloads = result.devlensDownloads || [];
  const idx = downloads.findIndex(d => d.downloadId === item.downloadId && d.timestamp === item.timestamp);
  if (idx !== -1) {
    downloads.splice(idx, 1);
    await chrome.storage.local.set({ devlensDownloads: downloads });
  }

  // Try to remove the file
  if (item.downloadId) {
    try { chrome.downloads.removeFile(item.downloadId); } catch (_) {}
  }

  allDownloads = downloads;
  populateSiteFilter();
  renderGallery();
  toast('삭제되었습니다');
}

async function clearAll() {
  if (!confirm('모든 다운로드 기록을 삭제하시겠습니까?')) return;
  await chrome.storage.local.set({ devlensDownloads: [] });
  allDownloads = [];
  populateSiteFilter();
  renderGallery();
  toast('모든 기록이 삭제되었습니다');
}

// ── Utils ──

function extractName(filepath) {
  if (!filepath) return 'unknown';
  return filepath.split('/').pop() || filepath;
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

function getFileIcon(contentType) {
  if (!contentType) return '\uD83D\uDCC4';
  if (contentType.includes('svg')) return '\uD83C\uDFA8';
  if (contentType.includes('gif')) return '\uD83C\uDF1F';
  return '\uD83D\uDDBC\uFE0F';
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

// ── Event Listeners ──

$('#searchInput').addEventListener('input', renderGallery);
$('#filterDate').addEventListener('change', renderGallery);
$('#filterSite').addEventListener('change', renderGallery);
$('#sortBy').addEventListener('change', renderGallery);
$('#btnClearAll').addEventListener('click', clearAll);

$('#btnGridView').addEventListener('click', () => {
  viewMode = 'grid';
  $('#btnGridView').classList.add('active');
  $('#btnListView').classList.remove('active');
  renderGallery();
});

$('#btnListView').addEventListener('click', () => {
  viewMode = 'list';
  $('#btnListView').classList.add('active');
  $('#btnGridView').classList.remove('active');
  renderGallery();
});

// ── Init ──

loadDownloads();
