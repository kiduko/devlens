import { useFilterStore } from '../../stores/filter-store';
import { RequestList } from './RequestList';
import { TimelineView } from './TimelineView';
import { WaterfallView } from './WaterfallView';

export function RequestListContainer() {
  const viewMode = useFilterStore((s) => s.viewMode);

  switch (viewMode) {
    case 'timeline':
      return <TimelineView />;
    case 'waterfall':
      return <WaterfallView />;
    default:
      return <RequestList />;
  }
}
