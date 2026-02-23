import { useRequestStore } from '../../stores/request-store';
import { useSwaggerStore } from '../../stores/swagger-store';
import { useFilteredRequests } from '../../hooks/useRequests';

export function StatusBar() {
  const totalRequests = useRequestStore((s) => s.requests.length);
  const filteredRequests = useFilteredRequests();
  const specs = useSwaggerStore((s) => s.specs);

  return (
    <div className="flex items-center justify-between px-3 py-1 border-t border-gray-200 bg-gray-50 text-[10px] text-gray-500 shrink-0">
      <span>
        {filteredRequests.length === totalRequests
          ? `${totalRequests} requests`
          : `${filteredRequests.length} / ${totalRequests} requests`}
      </span>
      {specs.length > 0 && (
        <span>
          {specs.length} spec{specs.length > 1 ? 's' : ''} loaded
        </span>
      )}
    </div>
  );
}
