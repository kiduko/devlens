import type { CapturedRequest, ParsedSpec } from '../types';

interface ExportData {
  exportedAt: string;
  specs: { title: string; version: string; basePath: string }[];
  totalRequests: number;
  requests: CapturedRequest[];
}

export function exportToJson(
  requests: CapturedRequest[],
  specs: ParsedSpec[],
): string {
  const data: ExportData = {
    exportedAt: new Date().toISOString(),
    specs: specs.map(s => ({ title: s.title, version: s.version, basePath: s.basePath })),
    totalRequests: requests.length,
    requests,
  };

  return JSON.stringify(data, null, 2);
}

export function downloadJson(content: string, filename?: string) {
  const name = filename || `api-capture-${Date.now()}.json`;
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();

  URL.revokeObjectURL(url);
}
