import type { AccessItem } from '../types';

interface AccessAnalysisProps {
  items: AccessItem[];
}

export function AccessAnalysis({ items }: AccessAnalysisProps) {
  if (items.length === 0) return null;

  return (
    <div className="dl-info-section">
      <div className="dl-info-section-header">접근 권한</div>
      <div className="dl-info-section-body dl-access-body">
        {items.map((item, i) => (
          <div key={i} className={`dl-access-tag dl-${item.level}`}>
            <span className="dl-access-icon">{item.icon}</span>
            <div className="dl-access-detail">
              <span className="dl-access-name">{item.label}</span>
              <span className="dl-access-desc">{item.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
