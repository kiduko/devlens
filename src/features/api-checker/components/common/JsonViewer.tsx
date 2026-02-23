import { useState } from 'react';
import { tryParseJson } from '../../utils/formatters';

interface JsonViewerProps {
  content: string;
  maxHeight?: string;
}

export function JsonViewer({ content, maxHeight = '300px' }: JsonViewerProps) {
  const [collapsed, setCollapsed] = useState(false);

  const parsed = tryParseJson(content);
  const formatted = parsed !== null
    ? JSON.stringify(parsed, null, 2)
    : content;

  return (
    <div className="relative">
      {parsed !== null && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-1 right-1 text-[10px] text-gray-400 hover:text-gray-600 px-1"
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      )}
      <pre
        className="text-xs font-mono bg-gray-50 p-2 rounded overflow-auto whitespace-pre-wrap break-all"
        style={{ maxHeight: collapsed ? '60px' : maxHeight }}
      >
        {formatted}
      </pre>
    </div>
  );
}
