import { useRecordingStore } from '../../stores/recording-store';

export function RecordingIndicator() {
  const recording = useRecordingStore((s) => s.recording);

  if (!recording) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 border-b border-red-100">
      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      <span className="text-[10px] text-red-600 font-medium">Recording...</span>
    </div>
  );
}
