import { useState, useCallback } from 'react';
import { UrlInput } from './UrlInput';
import { FileUpload } from './FileUpload';
import { GroupSelector } from './GroupSelector';
import { useSwaggerSpec } from '../../hooks/useSwaggerSpec';
import { useActiveSpecs } from '../../hooks/useActiveSpecs';
import { reloadActiveSpecs, getLastReloadTime } from '../../hooks/useSpecGroups';

function formatRelativeTime(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SwaggerImport() {
  const [mode, setMode] = useState<'url' | 'file'>('url');
  const [showForm, setShowForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastReload, setLastReload] = useState(getLastReloadTime);
  const { loading, error, loadFromUrl, loadFromText, remove } = useSwaggerSpec();
  const activeSpecs = useActiveSpecs();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reloadActiveSpecs();
      setLastReload(getLastReloadTime());
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <div className="border-b border-gray-200">
      {/* Group selector + refresh + spec count */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <GroupSelector />
          {lastReload > 0 && (
            <span className="text-[10px] text-gray-400">{formatRelativeTime(lastReload)}</span>
          )}
          <button
            disabled={refreshing || activeSpecs.length === 0}
            onClick={handleRefresh}
            className="text-gray-400 hover:text-blue-500 disabled:opacity-30"
            title="Refresh active specs"
          >
            <svg className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4.93 15.36A8 8 0 0118.36 4.64M19.07 8.64A8 8 0 015.64 19.36" />
            </svg>
          </button>
        </div>
        <span className="text-[10px] text-gray-400">
          {activeSpecs.length} spec{activeSpecs.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Active group specs list */}
      {activeSpecs.length > 0 && (
        <div className="px-3 py-1.5 space-y-1 bg-blue-50 border-b border-blue-100">
          {activeSpecs.map((spec) => (
            <div key={spec.id} className="flex items-center justify-between">
              <div className="text-xs truncate">
                <span className="font-medium text-blue-700">{spec.title}</span>
                <span className="text-blue-500 ml-1">v{spec.version}</span>
                <span className="text-blue-400 ml-1">({spec.endpoints.length} endpoints)</span>
                {spec.basePath && (
                  <span className="text-blue-300 ml-1">[{spec.basePath}]</span>
                )}
              </div>
              <button
                onClick={() => remove(spec.id)}
                className="text-[10px] text-blue-400 hover:text-red-500 ml-2 shrink-0"
              >
                X
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add spec toggle */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 text-left"
        >
          + Add API Spec
        </button>
      )}

      {/* Add spec form */}
      {showForm && (
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600">Import Swagger/OpenAPI</span>
              <div className="flex text-[10px] bg-gray-100 rounded">
                <button
                  onClick={() => setMode('url')}
                  className={`px-2 py-0.5 rounded ${mode === 'url' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
                >
                  URL
                </button>
                <button
                  onClick={() => setMode('file')}
                  className={`px-2 py-0.5 rounded ${mode === 'file' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
                >
                  File
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowForm(false)}
              className="text-[10px] text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>

          {mode === 'url' ? (
            <UrlInput onSubmit={(url) => { loadFromUrl(url); setShowForm(false); }} loading={loading} />
          ) : (
            <FileUpload onLoad={(text) => { loadFromText(text); setShowForm(false); }} loading={loading} />
          )}

          {error && (
            <p className="text-[10px] text-red-500 mt-1">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
