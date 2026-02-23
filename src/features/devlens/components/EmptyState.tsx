export function EmptyState() {
  return (
    <div className="dl-empty-state">
      <div className="dl-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
      <p className="dl-empty-title"><kbd>Cmd</kbd>+클릭으로 미디어 선택</p>
      <p className="dl-empty-desc">
        <strong>Cmd(⌘)</strong> 키를 누른 채 이미지나 동영상을 클릭하세요
      </p>
      <div className="dl-features">
        <div className="dl-feature-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <span>이미지 분석 및 저장</span>
        </div>
        <div className="dl-feature-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span>동영상 다운로드</span>
        </div>
      </div>
    </div>
  );
}
