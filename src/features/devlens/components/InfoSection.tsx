import type { ReactNode } from 'react';
import { useState } from 'react';
import { InfoRow } from './InfoRow';

interface InfoSectionProps {
  title: string;
  rows: Array<{ label: string; value: string; renderValue?: ReactNode }>;
  defaultCollapsed?: boolean;
  className?: string;
  headerClassName?: string;
  children?: React.ReactNode;
}

export function InfoSection({ title, rows, defaultCollapsed = false, className, headerClassName, children }: InfoSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const isUrlLabel = (label: string) => label === 'URL' || label === '스트림 URL' || label === '소스';

  return (
    <div className={`dl-info-section${collapsed ? ' dl-collapsed' : ''}${className ? ' ' + className : ''}`}>
      <div
        className={`dl-info-section-header${headerClassName ? ' ' + headerClassName : ''}`}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span>{title}</span>
      </div>
      {!collapsed && (
        <div className="dl-info-section-body">
          {rows.map((row, i) => (
            <InfoRow
              key={i}
              label={row.label}
              value={row.value}
              renderValue={row.renderValue}
              isUrl={isUrlLabel(row.label)}
            />
          ))}
          {children}
        </div>
      )}
    </div>
  );
}
