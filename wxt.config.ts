import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'DevLens',
    description: '이미지/영상 분석 및 API 모니터링 도구',
    permissions: [
      'activeTab',
      'downloads',
      'contextMenus',
      'sidePanel',
      'storage',
      'offscreen',
      'webRequest',
      'cookies',
      'debugger',
      'tabs',
    ],
    host_permissions: ['<all_urls>'],
    side_panel: {
      default_path: 'sidepanel.html',
    },
    icons: {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
    action: {
      default_title: 'DevLens 열기',
      default_icon: {
        16: 'icons/icon16.png',
        48: 'icons/icon48.png',
        128: 'icons/icon128.png',
      },
    },
  },
});
