import { useCallback } from 'react';
import { useSwaggerStore } from '../stores/swagger-store';
import { useGroupStore } from '../stores/group-store';
import { useRequestStore } from '../stores/request-store';
import { useFilterStore } from '../stores/filter-store';
import { parseSwaggerFromUrl, parseSwaggerFromText } from '../services/swagger-parser';
import { matchRequests } from '../services/request-matcher';
import { sendToBackground } from '../messaging/client';
import type { ParsedSpec, SpecGroupData } from '../types';

function getActiveSpecs(): ParsedSpec[] {
  const { groups, activeGroupId } = useGroupStore.getState();
  const { specs } = useSwaggerStore.getState();
  if (!activeGroupId) return [];
  const group = groups.find((g) => g.id === activeGroupId);
  if (!group) return [];
  const idSet = new Set(group.specIds);
  return specs.filter((s) => idSet.has(s.id));
}

function buildGroupData(): SpecGroupData {
  return {
    groups: useGroupStore.getState().groups,
    activeGroupId: useGroupStore.getState().activeGroupId,
    specs: useSwaggerStore.getState().specs,
  };
}

function reMatchRequests() {
  const activeSpecs = getActiveSpecs();
  const store = useRequestStore.getState();
  const matched = matchRequests(store.requests, activeSpecs);
  useRequestStore.setState({ requests: matched });
}

async function syncToBackground() {
  const data = buildGroupData();
  await sendToBackground({ type: 'SET_SPEC_GROUP_DATA', data });
}

export function useSwaggerSpec() {
  const { specs, loading, error, addSpec, removeSpec, setLoading, setError, clearSpecs } = useSwaggerStore();

  const loadFromUrl = useCallback(async (url: string) => {
    setLoading(true);
    try {
      const parsed = await parseSwaggerFromUrl(url);
      addSpec(parsed);

      // Add to active group
      const { activeGroupId } = useGroupStore.getState();
      if (activeGroupId) {
        useGroupStore.getState().addSpecToGroup(activeGroupId, parsed.id);
      }

      await syncToBackground();
      reMatchRequests();
      useFilterStore.getState().setMatch('MATCHED');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spec');
    }
  }, [addSpec, setLoading, setError]);

  const loadFromText = useCallback(async (text: string) => {
    setLoading(true);
    try {
      const parsed = await parseSwaggerFromText(text);
      addSpec(parsed);

      // Add to active group
      const { activeGroupId } = useGroupStore.getState();
      if (activeGroupId) {
        useGroupStore.getState().addSpecToGroup(activeGroupId, parsed.id);
      }

      await syncToBackground();
      reMatchRequests();
      useFilterStore.getState().setMatch('MATCHED');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse spec');
    }
  }, [addSpec, setLoading, setError]);

  const remove = useCallback(async (id: string) => {
    // Remove from all groups
    const { groups } = useGroupStore.getState();
    for (const group of groups) {
      if (group.specIds.includes(id)) {
        useGroupStore.getState().removeSpecFromGroup(group.id, id);
      }
    }

    removeSpec(id);
    await syncToBackground();
    reMatchRequests();

    const allActiveSpecs = getActiveSpecs();
    if (allActiveSpecs.length === 0) {
      useFilterStore.getState().setMatch('ALL');
    }
  }, [removeSpec]);

  const clearAll = useCallback(async () => {
    clearSpecs();
    // Clear specIds from all groups
    const { groups } = useGroupStore.getState();
    for (const group of groups) {
      useGroupStore.getState().setGroups(
        groups.map((g) => ({ ...g, specIds: [] })),
      );
    }
    await syncToBackground();
    useFilterStore.getState().setMatch('ALL');
  }, [clearSpecs]);

  return { specs, loading, error, loadFromUrl, loadFromText, remove, clearAll };
}
