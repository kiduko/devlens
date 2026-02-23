import { useSettingsStore } from '../stores/settings-store';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, setSettings } = useSettingsStore();

  const getFolderPreview = () => {
    const mode = settings.folderMode;
    const root = settings.rootFolder || 'DevLens';
    if (mode === 'none') return `${root}/devlens_image.jpg`;
    const today = new Date().toISOString().slice(0, 10);
    const site = 'example.com';
    const parts = [root];
    if (mode === 'date') parts.push(today);
    else if (mode === 'site') parts.push(site);
    else if (mode === 'date-site') { parts.push(today); parts.push(site); }
    else if (mode === 'site-date') { parts.push(site); parts.push(today); }
    parts.push('devlens_image.jpg');
    return parts.join('/');
  };

  return (
    <div className="dl-settings-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dl-settings-panel">
        <div className="dl-settings-header">
          <span className="dl-settings-title">설정</span>
          <button className="dl-settings-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="dl-settings-body">
          <div className="dl-setting-item">
            <div className="dl-setting-info">
              <span className="dl-setting-label">자동 저장</span>
              <span className="dl-setting-desc">이미지 분석 후 자동으로 다운로드</span>
            </div>
            <label className="dl-toggle">
              <input type="checkbox" checked={settings.autoSave} onChange={(e) => setSettings({ autoSave: e.target.checked })} />
              <span className="dl-toggle-slider" />
            </label>
          </div>
          <div className="dl-setting-item">
            <div className="dl-setting-info">
              <span className="dl-setting-label">이미지 히스토리</span>
              <span className="dl-setting-desc">최근 분석한 이미지 기록 표시</span>
            </div>
            <label className="dl-toggle">
              <input type="checkbox" checked={settings.enableHistory} onChange={(e) => setSettings({ enableHistory: e.target.checked })} />
              <span className="dl-toggle-slider" />
            </label>
          </div>
          <div className="dl-setting-item">
            <div className="dl-setting-info">
              <span className="dl-setting-label">이미지 오버레이</span>
              <span className="dl-setting-desc">페이지 이미지 위에 인증 상태 및 정보 뱃지 표시</span>
            </div>
            <label className="dl-toggle">
              <input type="checkbox" checked={settings.enableOverlay} onChange={(e) => setSettings({ enableOverlay: e.target.checked })} />
              <span className="dl-toggle-slider" />
            </label>
          </div>
          <div className="dl-setting-item">
            <div className="dl-setting-info">
              <span className="dl-setting-label">파일명 접두사</span>
              <span className="dl-setting-desc">저장 파일명 앞에 붙는 텍스트</span>
            </div>
            <input type="text" className="dl-setting-input" value={settings.filePrefix} onChange={(e) => setSettings({ filePrefix: e.target.value })} placeholder="devlens_" />
          </div>
          <div className="dl-setting-item">
            <div className="dl-setting-info">
              <span className="dl-setting-label">저장 포맷</span>
              <span className="dl-setting-desc">자동 저장 시 이미지 포맷</span>
            </div>
            <select className="dl-setting-select" value={settings.saveFormat} onChange={(e) => setSettings({ saveFormat: e.target.value as any })}>
              <option value="original">원본 유지</option>
              <option value="png">PNG로 변환</option>
              <option value="jpg">JPG로 변환</option>
            </select>
          </div>
          <div className="dl-setting-item">
            <div className="dl-setting-info">
              <span className="dl-setting-label">저장 폴더 구조</span>
              <span className="dl-setting-desc">자동 저장 시 하위 폴더 생성 방식</span>
            </div>
            <select className="dl-setting-select" value={settings.folderMode} onChange={(e) => setSettings({ folderMode: e.target.value as any })}>
              <option value="none">없음</option>
              <option value="date">날짜별</option>
              <option value="site">사이트별</option>
              <option value="date-site">{'날짜 > 사이트'}</option>
              <option value="site-date">{'사이트 > 날짜'}</option>
            </select>
          </div>
          <div className="dl-setting-item">
            <div className="dl-setting-info">
              <span className="dl-setting-label">루트 폴더</span>
              <span className="dl-setting-desc">다운로드 폴더 내 루트 폴더명</span>
            </div>
            <input type="text" className="dl-setting-input" value={settings.rootFolder} onChange={(e) => setSettings({ rootFolder: e.target.value })} placeholder="DevLens" />
          </div>
          <div className="dl-setting-item dl-folder-preview-item">
            <div className="dl-setting-info">
              <span className="dl-setting-label">경로 미리보기</span>
              <span className="dl-setting-desc dl-folder-preview">{getFolderPreview()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
