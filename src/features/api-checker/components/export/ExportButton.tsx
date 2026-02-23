import { useRequestStore } from '../../stores/request-store';
import { useSwaggerStore } from '../../stores/swagger-store';
import { exportToJson, downloadJson } from '../../services/export-service';

export function ExportButton() {
  const requests = useRequestStore((s) => s.requests);
  const specs = useSwaggerStore((s) => s.specs);

  const handleExport = () => {
    if (requests.length === 0) return;
    const json = exportToJson(requests, specs);
    downloadJson(json);
  };

  return (
    <button
      onClick={handleExport}
      disabled={requests.length === 0}
      className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      title="Export as JSON"
    >
      Export
    </button>
  );
}
