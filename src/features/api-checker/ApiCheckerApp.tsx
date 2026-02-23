import { useEffect } from 'react';
import { Header } from './components/layout/Header';
import { StatusBar } from './components/layout/StatusBar';
import { RecordingIndicator } from './components/recording/RecordingIndicator';
import { SwaggerImport } from './components/swagger/SwaggerImport';
import { FilterBar } from './components/filters/FilterBar';
import { RequestListContainer } from './components/requests/RequestListContainer';
import { RequestDetail } from './components/requests/RequestDetail';
import { useRequestStore } from './stores/request-store';
import { useRecordingStore } from './stores/recording-store';
import { useSwaggerStore } from './stores/swagger-store';
import { useGroupStore } from './stores/group-store';
import { matchRequest } from './services/request-matcher';
import { onBackgroundMessage, sendToBackground } from './messaging/client';
import { reloadAllSpecsIfStale } from './hooks/useSpecGroups';
import type { CapturedRequest, ParsedSpec, SpecGroupData } from './types';

function getActiveSpecs(): ParsedSpec[] {
  const { groups, activeGroupId } = useGroupStore.getState();
  const { specs } = useSwaggerStore.getState();
  if (!activeGroupId) return [];
  const group = groups.find((g) => g.id === activeGroupId);
  if (!group) return [];
  const idSet = new Set(group.specIds);
  return specs.filter((s) => idSet.has(s.id));
}

export default function ApiCheckerApp() {
  useEffect(() => {
    const unsubscribe = onBackgroundMessage((message) => {
      switch (message.type) {
        case 'REQUEST_CAPTURED': {
          const activeSpecs = getActiveSpecs();
          const matched: CapturedRequest[] = message.requests.map(req => ({
            ...req,
            matchResult: matchRequest(req, activeSpecs),
          }));
          useRequestStore.getState().addRequests(matched);
          break;
        }
        case 'RECORDING_STATE_CHANGED':
          useRecordingStore.getState().setRecording(message.recording, message.tabId);
          break;
        case 'SWAGGER_SPEC_LOADED': {
          const store = useSwaggerStore.getState();
          store.clearSpecs();
          for (const spec of message.specs) {
            store.addSpec(spec);
          }
          break;
        }
        case 'ERROR':
          console.error('Background error:', message.message);
          break;
      }
    });

    // Sync initial state
    sendToBackground({ type: 'GET_RECORDING_STATE' }).then(res => {
      if (res.success && res.data) {
        const { recording, tabId } = res.data as { recording: boolean; tabId: number | null };
        useRecordingStore.getState().setRecording(recording, tabId);
      }
    });

    // Load spec group data (with migration), then reload specs from URLs
    sendToBackground({ type: 'GET_SPEC_GROUP_DATA' }).then(async (res) => {
      if (res.success && res.data) {
        const data = res.data as SpecGroupData;
        useSwaggerStore.getState().setSpecs(data.specs);
        useGroupStore.getState().setGroups(data.groups);
        useGroupStore.getState().setActiveGroupId(data.activeGroupId);

        // Re-fetch specs if last reload was over 24h ago
        await reloadAllSpecsIfStale();
      }
    });

    return unsubscribe;
  }, []);

  return (
    <div className="flex flex-col h-full">
      <Header />
      <RecordingIndicator />
      <SwaggerImport />
      <FilterBar />
      <RequestListContainer />
      <RequestDetail />
      <StatusBar />
    </div>
  );
}
