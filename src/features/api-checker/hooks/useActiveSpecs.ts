import { useMemo } from 'react';
import { useSwaggerStore } from '../stores/swagger-store';
import { useGroupStore } from '../stores/group-store';

export function useActiveSpecs() {
  const specs = useSwaggerStore((s) => s.specs);
  const groups = useGroupStore((s) => s.groups);
  const activeGroupId = useGroupStore((s) => s.activeGroupId);

  return useMemo(() => {
    if (!activeGroupId) return [];
    const group = groups.find((g) => g.id === activeGroupId);
    if (!group) return [];
    const idSet = new Set(group.specIds);
    return specs.filter((s) => idSet.has(s.id));
  }, [specs, groups, activeGroupId]);
}
