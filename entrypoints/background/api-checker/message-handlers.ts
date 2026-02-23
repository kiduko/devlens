import type { BackgroundMessage, BackgroundResponse, SidepanelMessage } from '../../../src/features/api-checker/messaging/protocol';
import type { CapturedRequest } from '../../../src/features/api-checker/types';
import type { ParsedSpec, SpecGroupData } from '../../../src/features/api-checker/types';
import { migrateToGroups, saveSpecGroupData } from '../../../src/features/api-checker/services/storage-service';
import { DebuggerManager } from './debugger-manager';
import { NetworkMonitor } from './network-monitor';

export class MessageHandlers {
  private debuggerManager: DebuggerManager;
  private networkMonitor: NetworkMonitor;
  private recordingTabId: number | null = null;
  private swaggerSpecs: ParsedSpec[] = [];
  private specGroupData: SpecGroupData | null = null;

  constructor() {
    this.debuggerManager = new DebuggerManager();
    this.networkMonitor = new NetworkMonitor(this.debuggerManager);

    this.debuggerManager.onDetach(() => {
      this.recordingTabId = null;
      this.networkMonitor.stopRecording();
      this.broadcastToSidepanel({
        type: 'RECORDING_STATE_CHANGED',
        recording: false,
        tabId: null,
      });
    });

    this.networkMonitor.onCapture((requests: CapturedRequest[]) => {
      this.broadcastToSidepanel({
        type: 'REQUEST_CAPTURED',
        requests,
      });
    });

    // Handle tab close
    chrome.tabs.onRemoved.addListener((tabId) => {
      if (tabId === this.recordingTabId) {
        this.stopRecording();
      }
    });
  }

  async handleMessage(message: BackgroundMessage): Promise<BackgroundResponse> {
    switch (message.type) {
      case 'START_RECORDING':
        return this.startRecording(message.tabId);

      case 'STOP_RECORDING':
        return this.stopRecording();

      case 'CLEAR_REQUESTS':
        this.networkMonitor.clearRequests();
        return { success: true };

      case 'GET_RECORDING_STATE':
        return {
          success: true,
          data: {
            recording: this.recordingTabId !== null,
            tabId: this.recordingTabId,
          },
        };

      case 'SET_SWAGGER_SPEC':
        this.swaggerSpecs = message.specs;
        await chrome.storage.local.set({ swaggerSpecs: message.specs });
        return { success: true };

      case 'GET_SWAGGER_SPEC':
        if (this.swaggerSpecs.length === 0) {
          const result = await chrome.storage.local.get('swaggerSpecs');
          this.swaggerSpecs = result.swaggerSpecs || [];
        }
        return { success: true, data: this.swaggerSpecs };

      case 'GET_SPEC_GROUP_DATA': {
        if (!this.specGroupData) {
          this.specGroupData = await migrateToGroups();
        }
        return { success: true, data: this.specGroupData };
      }

      case 'SET_SPEC_GROUP_DATA': {
        this.specGroupData = message.data;
        this.swaggerSpecs = message.data.specs;
        await saveSpecGroupData(message.data);
        return { success: true };
      }

      default:
        return { success: false, error: 'Unknown message type' };
    }
  }

  private async startRecording(tabId: number): Promise<BackgroundResponse> {
    try {
      await this.debuggerManager.attach(tabId);
      this.recordingTabId = tabId;
      this.networkMonitor.startRecording();

      this.broadcastToSidepanel({
        type: 'RECORDING_STATE_CHANGED',
        recording: true,
        tabId,
      });

      return { success: true };
    } catch (err) {
      return { success: false, error: `Failed to start recording: ${err}` };
    }
  }

  private async stopRecording(): Promise<BackgroundResponse> {
    try {
      this.networkMonitor.stopRecording();
      await this.debuggerManager.detach();
      this.recordingTabId = null;

      this.broadcastToSidepanel({
        type: 'RECORDING_STATE_CHANGED',
        recording: false,
        tabId: null,
      });

      return { success: true };
    } catch (err) {
      return { success: false, error: `Failed to stop recording: ${err}` };
    }
  }

  private broadcastToSidepanel(message: SidepanelMessage) {
    chrome.runtime.sendMessage(message).catch(() => {
      // Sidepanel may not be open
    });
  }
}
