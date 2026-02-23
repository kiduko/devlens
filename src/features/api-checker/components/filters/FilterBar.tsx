import { useFilterStore, type MethodFilter, type StatusFilter, type MatchFilter } from '../../stores/filter-store';

const methods: MethodFilter[] = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const statuses: StatusFilter[] = ['ALL', '2xx', '3xx', '4xx', '5xx'];
const matches: MatchFilter[] = ['ALL', 'MATCHED', 'UNMATCHED'];

export function FilterBar() {
  const { searchText, method, status, match, setSearchText, setMethod, setStatus, setMatch } = useFilterStore();

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 border-b border-gray-200 bg-gray-50">
      <input
        type="text"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="Filter..."
        className="flex-1 min-w-[80px] px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-400"
      />
      <SelectFilter<MethodFilter>
        value={method}
        options={methods}
        onChange={setMethod}
      />
      <SelectFilter<StatusFilter>
        value={status}
        options={statuses}
        onChange={setStatus}
      />
      <SelectFilter<MatchFilter>
        value={match}
        options={matches}
        onChange={setMatch}
      />
    </div>
  );
}

function SelectFilter<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="text-[10px] border border-gray-300 rounded px-1 py-0.5 bg-white text-gray-600 focus:outline-none"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
