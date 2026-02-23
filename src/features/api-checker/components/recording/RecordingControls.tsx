import { useRecording } from '../../hooks/useRecording';

export function RecordingControls() {
  const { recording, startRecording, stopRecording, clearRequests } = useRecording();

  return (
    <div className="flex items-center gap-1">
      {recording ? (
        <button
          onClick={stopRecording}
          className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
          title="Stop recording"
        >
          <span className="w-2 h-2 rounded-sm bg-red-500" />
          Stop
        </button>
      ) : (
        <button
          onClick={startRecording}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
          title="Start recording"
        >
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Record
        </button>
      )}
      <button
        onClick={clearRequests}
        className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors"
        title="Clear requests"
      >
        Clear
      </button>
    </div>
  );
}
