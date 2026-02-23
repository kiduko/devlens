import { RecordingControls } from '../recording/RecordingControls';
import { ExportButton } from '../export/ExportButton';
import { ViewModeToggle } from '../common/ViewModeToggle';

export function Header() {
  return (
    <header className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50 shrink-0">
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-semibold text-gray-800">API Checker</h1>
        <ViewModeToggle />
      </div>
      <div className="flex items-center gap-1">
        <RecordingControls />
        <ExportButton />
      </div>
    </header>
  );
}
