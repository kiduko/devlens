import { useRef, type ChangeEvent } from 'react';

interface FileUploadProps {
  onLoad: (content: string) => void;
  loading: boolean;
}

export function FileUpload({ onLoad, loading }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onLoad(reader.result);
      }
    };
    reader.readAsText(file);

    // Reset input
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.yaml,.yml"
        onChange={handleChange}
        className="hidden"
        disabled={loading}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="w-full px-3 py-2 text-xs border border-dashed border-gray-300 rounded text-gray-500 hover:border-blue-400 hover:text-blue-500 disabled:opacity-50"
      >
        {loading ? 'Loading...' : 'Choose JSON or YAML file'}
      </button>
    </div>
  );
}
