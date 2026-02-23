import { MessageHandlers as ApiCheckerHandlers } from './api-checker/message-handlers';
import { initDevLensBackground, handlePortConnect, handleMessage as devlensHandleMessage } from './devlens/message-handler';

export default defineBackground(() => {
  // Open side panel when extension icon is clicked
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  // Initialize DevLens background
  initDevLensBackground();

  // Initialize API Checker handlers
  const apiChecker = new ApiCheckerHandlers();

  // Message router: DevLens uses { action }, API Checker uses { type }
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if ('action' in msg) {
      devlensHandleMessage(msg);
      return false;
    }
    if ('type' in msg) {
      apiChecker.handleMessage(msg).then(sendResponse).catch(err => {
        sendResponse({ success: false, error: String(err) });
      });
      return true; // async response
    }
    return false;
  });

  // Port connections: DevLens sidepanel uses port name 'devlens-sidepanel'
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'devlens-sidepanel') {
      handlePortConnect(port);
    }
  });

  console.log('DevLens background initialized');
});
