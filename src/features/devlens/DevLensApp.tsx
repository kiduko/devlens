import { useState, useEffect } from 'react';
import { useDevLensStore } from './stores/devlens-store';
import { useSettingsStore } from './stores/settings-store';
import { useDevLensMessages } from './hooks/useDevLensMessages';
import { ToastContainer } from '../../shared/components/Toast';
import { Header } from './components/Header';
import { EmptyState } from './components/EmptyState';
import { LoadingState } from './components/LoadingState';
import { ImageView } from './components/ImageView';
import { VideoView } from './components/VideoView';
import { HistoryBar } from './components/HistoryBar';
import { SettingsPanel } from './components/SettingsPanel';
import './devlens.css';

export default function DevLensApp() {
  const { viewState } = useDevLensStore();
  const { loadSettings } = useSettingsStore();
  const { sendMessage } = useDevLensMessages();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isPopup = new URLSearchParams(location.search).has('popup');

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <div className={`dl-root${isPopup ? ' dl-popup-mode' : ''}`}>
      <Header isPopup={isPopup} onSettingsOpen={() => setSettingsOpen(true)} />

      <main className="dl-main">
        {viewState === 'empty' && <EmptyState />}
        {viewState === 'loading' && <LoadingState />}
        {viewState === 'image' && <ImageView sendMessage={sendMessage} />}
        {viewState === 'video' && <VideoView />}
      </main>

      <HistoryBar sendMessage={sendMessage} />

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      <ToastContainer />
    </div>
  );
}
