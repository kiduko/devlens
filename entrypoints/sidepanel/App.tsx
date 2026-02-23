import { useState, lazy, Suspense } from 'react';

const DevLensApp = lazy(() => import('../../src/features/devlens/DevLensApp'));
const ApiCheckerApp = lazy(() => import('../../src/features/api-checker/ApiCheckerApp'));

type ActiveTab = 'devlens' | 'api-checker';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('devlens');

  return (
    <div className="h-full flex flex-col">
      {/* Tab Bar */}
      <div className="flex border-b border-gray-200 bg-gray-50 shrink-0">
        <button
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'devlens'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('devlens')}
        >
          DevLens
        </button>
        <button
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'api-checker'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('api-checker')}
        >
          API Checker
        </button>
      </div>

      {/* Content - both mounted, hidden via CSS for state preservation */}
      <div className="flex-1 overflow-hidden relative">
        <div className={activeTab === 'devlens' ? 'h-full' : 'hidden'}>
          <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>}>
            <DevLensApp />
          </Suspense>
        </div>
        <div className={activeTab === 'api-checker' ? 'h-full' : 'hidden'}>
          <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>}>
            <ApiCheckerApp />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
