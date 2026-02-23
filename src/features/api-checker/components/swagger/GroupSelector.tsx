import { useState, useRef, useEffect } from 'react';
import { useSpecGroups } from '../../hooks/useSpecGroups';

export function GroupSelector() {
  const { groups, activeGroupId, createGroup, removeGroup, renameGroup, switchGroup, exportData, importData } = useSpecGroups();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeGroup = groups.find((g) => g.id === activeGroupId);

  useEffect(() => {
    if ((creating || editingId) && inputRef.current) {
      inputRef.current.focus();
    }
  }, [creating, editingId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const handleCreate = async () => {
    const name = inputValue.trim();
    if (!name) return;
    await createGroup(name);
    setInputValue('');
    setCreating(false);
  };

  const handleRename = async () => {
    const name = inputValue.trim();
    if (!name || !editingId) return;
    await renameGroup(editingId, name);
    setInputValue('');
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') action();
    if (e.key === 'Escape') {
      setCreating(false);
      setEditingId(null);
      setInputValue('');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 min-w-0"
      >
        <span className="truncate max-w-[120px] font-medium text-gray-700">
          {activeGroup?.name || 'No Group'}
        </span>
        <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <div className="py-1 max-h-60 overflow-y-auto">
            {groups.map((group) => (
              <div
                key={group.id}
                className={`flex items-center justify-between px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50 ${
                  group.id === activeGroupId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                {editingId === group.id ? (
                  <input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, handleRename)}
                    onBlur={handleRename}
                    className="flex-1 px-1 py-0.5 text-xs border border-blue-300 rounded outline-none"
                  />
                ) : (
                  <>
                    <span
                      className="flex-1 truncate"
                      onClick={() => { switchGroup(group.id); setOpen(false); }}
                    >
                      {group.name}
                    </span>
                    <div className="flex items-center gap-1 ml-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(group.id);
                          setInputValue(group.name);
                        }}
                        className="text-[10px] text-gray-400 hover:text-blue-500"
                        title="Rename"
                      >
                        E
                      </button>
                      {groups.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeGroup(group.id);
                          }}
                          className="text-[10px] text-gray-400 hover:text-red-500"
                          title="Delete"
                        >
                          X
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 px-3 py-1.5">
            {creating ? (
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleCreate)}
                onBlur={() => { if (!inputValue.trim()) setCreating(false); else handleCreate(); }}
                placeholder="Group name..."
                className="w-full px-1 py-0.5 text-xs border border-blue-300 rounded outline-none"
              />
            ) : (
              <button
                onClick={() => { setCreating(true); setInputValue(''); }}
                className="text-xs text-gray-500 hover:text-blue-600"
              >
                + New Group
              </button>
            )}
          </div>

          <div className="border-t border-gray-100 px-3 py-1.5 flex gap-2">
            <button
              onClick={() => { exportData(); setOpen(false); }}
              className="text-xs text-gray-500 hover:text-blue-600"
            >
              Export
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-gray-500 hover:text-blue-600"
            >
              Import
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              await importData(reader.result as string);
              setOpen(false);
            } catch (err) {
              alert(`Import failed: ${err instanceof Error ? err.message : 'Invalid JSON file'}`);
            }
          };
          reader.readAsText(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
