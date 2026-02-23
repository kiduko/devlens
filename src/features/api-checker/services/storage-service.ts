import type { ParsedSpec, SpecGroupData } from '../types';

const KEYS = {
  SWAGGER_SPECS: 'swaggerSpecs',
  SPEC_GROUP_DATA: 'specGroupData',
} as const;

export async function saveSwaggerSpecs(specs: ParsedSpec[]): Promise<void> {
  await chrome.storage.local.set({ [KEYS.SWAGGER_SPECS]: specs });
}

export async function loadSwaggerSpecs(): Promise<ParsedSpec[]> {
  const result = await chrome.storage.local.get(KEYS.SWAGGER_SPECS);
  return result[KEYS.SWAGGER_SPECS] || [];
}

export async function saveSpecGroupData(data: SpecGroupData): Promise<void> {
  await chrome.storage.local.set({ [KEYS.SPEC_GROUP_DATA]: data });
}

export async function loadSpecGroupData(): Promise<SpecGroupData | null> {
  const result = await chrome.storage.local.get(KEYS.SPEC_GROUP_DATA);
  return result[KEYS.SPEC_GROUP_DATA] || null;
}

export async function migrateToGroups(): Promise<SpecGroupData> {
  const existing = await loadSpecGroupData();
  if (existing) return existing;

  const legacySpecs = await loadSwaggerSpecs();
  const defaultGroupId = crypto.randomUUID();
  const data: SpecGroupData = {
    groups: [{
      id: defaultGroupId,
      name: 'Default',
      specIds: legacySpecs.map((s) => s.id),
      createdAt: Date.now(),
    }],
    activeGroupId: defaultGroupId,
    specs: legacySpecs,
  };

  await saveSpecGroupData(data);
  await chrome.storage.local.remove(KEYS.SWAGGER_SPECS);
  return data;
}

export async function clearStorage(): Promise<void> {
  await chrome.storage.local.clear();
}
