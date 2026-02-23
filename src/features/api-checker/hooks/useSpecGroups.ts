import { useCallback } from 'react';
import { useGroupStore } from '../stores/group-store';
import { useSwaggerStore } from '../stores/swagger-store';
import { useRequestStore } from '../stores/request-store';
import { matchRequests } from '../services/request-matcher';
import { sendToBackground } from '../messaging/client';
import { parseSwaggerFromUrl } from '../services/swagger-parser';
import type { SpecGroupData, SpecGroupExport } from '../types';

function buildGroupData(): SpecGroupData {
  return {
    groups: useGroupStore.getState().groups,
    activeGroupId: useGroupStore.getState().activeGroupId,
    specs: useSwaggerStore.getState().specs,
  };
}

function getActiveSpecs(): import('../types').ParsedSpec[] {
  const { groups, activeGroupId } = useGroupStore.getState();
  const { specs } = useSwaggerStore.getState();
  if (!activeGroupId) return [];
  const group = groups.find((g) => g.id === activeGroupId);
  if (!group) return [];
  const idSet = new Set(group.specIds);
  return specs.filter((s) => idSet.has(s.id));
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

function exportData() {
  const { specs } = useSwaggerStore.getState();
  const specSources = specs
    .filter((s) => s.sourceUrl)
    .map((s) => ({ id: s.id, sourceUrl: s.sourceUrl! }));
  const data: SpecGroupExport = {
    groups: useGroupStore.getState().groups,
    activeGroupId: useGroupStore.getState().activeGroupId,
    specSources,
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `api-checker-specs-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importData(jsonString: string) {
  const data = JSON.parse(jsonString) as SpecGroupExport;
  if (!Array.isArray(data.groups) || !Array.isArray(data.specSources)) {
    throw new Error('Invalid format: groups and specSources arrays are required');
  }

  const results = await Promise.allSettled(
    data.specSources.map(async ({ id, sourceUrl }) => {
      const spec = await parseSwaggerFromUrl(sourceUrl);
      return { ...spec, id };
    }),
  );

  const specs = results
    .filter((r): r is PromiseFulfilledResult<import('../types').ParsedSpec> => r.status === 'fulfilled')
    .map((r) => r.value);

  const failed = results.filter((r) => r.status === 'rejected');

  useSwaggerStore.getState().setSpecs(specs);
  useGroupStore.getState().setGroups(data.groups);
  useGroupStore.getState().setActiveGroupId(data.activeGroupId ?? null);
  await syncToBackground();
  reMatchRequests();

  if (failed.length > 0) {
    throw new Error(`${specs.length} specs loaded, ${failed.length} failed to fetch`);
  }
}

const RELOAD_KEY = 'api-checker-last-reload';
const ONE_DAY = 24 * 60 * 60 * 1000;

async function doReload() {
  const activeSpecs = getActiveSpecs();
  const toReload = activeSpecs.filter((s) => s.sourceUrl);
  if (toReload.length === 0) return;

  const reloadIds = new Set(toReload.map((s) => s.id));
  const results = await Promise.allSettled(
    toReload.map(async (s) => {
      const fresh = await parseSwaggerFromUrl(s.sourceUrl!);
      return { ...fresh, id: s.id };
    }),
  );

  const reloaded = results
    .filter((r): r is PromiseFulfilledResult<import('../types').ParsedSpec> => r.status === 'fulfilled')
    .map((r) => r.value);

  const reloadedIds = new Set(reloaded.map((s) => s.id));
  const { specs } = useSwaggerStore.getState();
  const unchanged = specs.filter((s) => !reloadIds.has(s.id));
  const failedOriginals = toReload.filter((s) => !reloadedIds.has(s.id));

  useSwaggerStore.getState().setSpecs([...unchanged, ...reloaded, ...failedOriginals]);
  await syncToBackground();
  reMatchRequests();
  localStorage.setItem(RELOAD_KEY, String(Date.now()));
}

export async function reloadAllSpecsIfStale() {
  const last = Number(localStorage.getItem(RELOAD_KEY) || '0');
  if (Date.now() - last < ONE_DAY) return;
  await doReload();
}

export async function reloadActiveSpecs() {
  await doReload();
}

export function getLastReloadTime(): number {
  return Number(localStorage.getItem(RELOAD_KEY) || '0');
}

export function useSpecGroups() {
  const groups = useGroupStore((s) => s.groups);
  const activeGroupId = useGroupStore((s) => s.activeGroupId);

  const createGroup = useCallback(async (name: string) => {
    const group = {
      id: crypto.randomUUID(),
      name,
      specIds: [] as string[],
      createdAt: Date.now(),
    };
    useGroupStore.getState().addGroup(group);
    if (!useGroupStore.getState().activeGroupId) {
      useGroupStore.getState().setActiveGroupId(group.id);
    }
    await syncToBackground();
    return group;
  }, []);

  const removeGroup = useCallback(async (id: string) => {
    useGroupStore.getState().removeGroup(id);
    reMatchRequests();
    await syncToBackground();
  }, []);

  const renameGroup = useCallback(async (id: string, name: string) => {
    useGroupStore.getState().renameGroup(id, name);
    await syncToBackground();
  }, []);

  const switchGroup = useCallback(async (id: string) => {
    useGroupStore.getState().setActiveGroupId(id);
    reMatchRequests();
    await syncToBackground();
  }, []);

  const addSpecToGroup = useCallback(async (groupId: string, specId: string) => {
    useGroupStore.getState().addSpecToGroup(groupId, specId);
    reMatchRequests();
    await syncToBackground();
  }, []);

  const removeSpecFromGroup = useCallback(async (groupId: string, specId: string) => {
    useGroupStore.getState().removeSpecFromGroup(groupId, specId);
    reMatchRequests();
    await syncToBackground();
  }, []);

  return {
    groups,
    activeGroupId,
    createGroup,
    removeGroup,
    renameGroup,
    switchGroup,
    addSpecToGroup,
    removeSpecFromGroup,
    exportData,
    importData,
  };
}
