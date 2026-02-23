import { toast } from '../../../shared/components/Toast';

interface InfoRowProps {
  label: string;
  value: string;
  isHtml?: boolean;
  isUrl?: boolean;
}

export function InfoRow({ label, value, isHtml, isUrl }: InfoRowProps) {
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => toast('URL이 복사되었습니다'));
  };

  return (
    <div className="dl-info-row">
      <span className="dl-info-label">{label}</span>
      {isHtml ? (
        <span className="dl-info-value" dangerouslySetInnerHTML={{ __html: value }} />
      ) : (
        <span className={`dl-info-value${isUrl ? ' dl-url-value' : ''}`} title={isUrl ? value : undefined}>
          {value}
        </span>
      )}
      {isUrl && !isHtml && (
        <button className="dl-url-copy-btn" title="URL 복사" onClick={handleCopy}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
        </button>
      )}
    </div>
  );
}
