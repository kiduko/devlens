import { create } from 'zustand';
import type { SpecGroup } from '../types';

interface GroupState {
  groups: SpecGroup[];
  activeGroupId: string | null;

  setGroups: (groups: SpecGroup[]) => void;
  setActiveGroupId: (id: string | null) => void;
  addGroup: (group: SpecGroup) => void;
  removeGroup: (id: string) => void;
  renameGroup: (id: string, name: string) => void;
  addSpecToGroup: (groupId: string, specId: string) => void;
  removeSpecFromGroup: (groupId: string, specId: string) => void;
}

export const useGroupStore = create<GroupState>((set) => ({
  groups: [],
  activeGroupId: null,

  setGroups: (groups) => set({ groups }),
  setActiveGroupId: (id) => set({ activeGroupId: id }),
  addGroup: (group) => set((state) => ({ groups: [...state.groups, group] })),
  removeGroup: (id) => set((state) => ({
    groups: state.groups.filter((g) => g.id !== id),
    activeGroupId: state.activeGroupId === id ? null : state.activeGroupId,
  })),
  renameGroup: (id, name) => set((state) => ({
    groups: state.groups.map((g) => g.id === id ? { ...g, name } : g),
  })),
  addSpecToGroup: (groupId, specId) => set((state) => ({
    groups: state.groups.map((g) =>
      g.id === groupId && !g.specIds.includes(specId)
        ? { ...g, specIds: [...g.specIds, specId] }
        : g,
    ),
  })),
  removeSpecFromGroup: (groupId, specId) => set((state) => ({
    groups: state.groups.map((g) =>
      g.id === groupId ? { ...g, specIds: g.specIds.filter((s) => s !== specId) } : g,
    ),
  })),
}));
