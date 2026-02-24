type DebuggerTarget = chrome.debugger.Debuggee;

export class DebuggerManager {
  private attachedTabId: number | null = null;
  private onDetachCallback: (() => void) | null = null;

  constructor() {
    chrome.debugger.onDetach.addListener((_source, _reason) => {
      this.attachedTabId = null;
      this.onDetachCallback?.();
    });
  }

  onDetach(callback: () => void) {
    this.onDetachCallback = callback;
  }

  async attach(tabId: number): Promise<void> {
    if (this.attachedTabId === tabId) return;

    if (this.attachedTabId !== null) {
      await this.detach();
    }

    const target: DebuggerTarget = { tabId };
    await chrome.debugger.attach(target, '1.3');
    this.attachedTabId = tabId;

    // Enable network domain
    await chrome.debugger.sendCommand(target, 'Network.enable', {
      maxResourceBufferSize: 10 * 1024 * 1024,
      maxTotalBufferSize: 50 * 1024 * 1024,
    });
  }

  async detach(): Promise<void> {
    if (this.attachedTabId === null) return;

    try {
      await chrome.debugger.detach({ tabId: this.attachedTabId });
    } catch {
      // Already detached
    }
    this.attachedTabId = null;
  }

  async sendCommand(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (this.attachedTabId === null) {
      throw new Error('Debugger not attached');
    }
    return chrome.debugger.sendCommand({ tabId: this.attachedTabId }, method, params);
  }

  get isAttached(): boolean {
    return this.attachedTabId !== null;
  }

  get currentTabId(): number | null {
    return this.attachedTabId;
  }
}
