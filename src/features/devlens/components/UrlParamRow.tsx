import type { DetectedUrlParam } from '../types';

interface UrlParamRowProps {
  param: DetectedUrlParam;
  onChange: (value: string | number) => void;
}

export function UrlParamRow({ param, onChange }: UrlParamRowProps) {
  if (param.presets) {
    const options = [...param.presets];
    if (!options.includes(String(param.value))) {
      options.unshift(String(param.value));
    }
    return (
      <div className="dl-param-row">
        <span className="dl-info-label">{param.label}</span>
        <div className="dl-param-control">
          <select
            className="dl-param-select"
            value={String(param.value)}
            onChange={(e) => onChange(e.target.value)}
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt === String(param.value) && !param.presets?.includes(String(param.value))
                  ? `${opt} (현재)`
                  : opt}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="dl-param-row">
      <span className="dl-info-label">{param.label}</span>
      <div className="dl-param-control">
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <input
            type="number"
            className="dl-param-input"
            value={param.value}
            min={1}
            max={param.max}
            onChange={(e) => onChange(Number(e.target.value) || param.originalValue)}
          />
          {param.unit && <span className="dl-param-unit">{param.unit}</span>}
        </div>

        {['width', 'height', 'size'].includes(param.type) && (
          <div className="dl-param-multipliers">
            {['0.5x', '2x', 'MAX'].map((m) => (
              <button
                key={m}
                className="dl-param-mult-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  const orig = Number(param.originalValue);
                  if (m === 'MAX') onChange(param.type === 'quality' ? 100 : orig * 4);
                  else onChange(Math.round(orig * parseFloat(m)));
                }}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {param.type === 'quality' && (
          <input
            type="range"
            className="dl-param-slider"
            min={1}
            max={param.max || 100}
            value={Number(param.value)}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        )}

        {param.hint && <span className="dl-param-hint">{param.hint}</span>}
      </div>
    </div>
  );
}
