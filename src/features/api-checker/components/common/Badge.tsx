const methodColors: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-700',
  POST: 'bg-green-100 text-green-700',
  PUT: 'bg-amber-100 text-amber-700',
  PATCH: 'bg-orange-100 text-orange-700',
  DELETE: 'bg-red-100 text-red-700',
  HEAD: 'bg-purple-100 text-purple-700',
  OPTIONS: 'bg-gray-100 text-gray-700',
};

export function MethodBadge({ method }: { method: string }) {
  const color = methodColors[method.toUpperCase()] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${color} min-w-[38px] text-center`}>
      {method.toUpperCase()}
    </span>
  );
}

export function StatusBadge({ status }: { status: number }) {
  let color = 'text-gray-500';
  if (status >= 200 && status < 300) color = 'text-green-600';
  else if (status >= 300 && status < 400) color = 'text-blue-600';
  else if (status >= 400 && status < 500) color = 'text-amber-600';
  else if (status >= 500) color = 'text-red-600';

  return <span className={`font-mono text-xs ${color}`}>{status}</span>;
}

export function MatchBadge({ matched }: { matched: boolean }) {
  return matched ? (
    <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Matched" />
  ) : (
    <span className="inline-block w-2 h-2 rounded-full bg-gray-300" title="Unmatched" />
  );
}
