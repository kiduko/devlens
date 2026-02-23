import type { CapturedRequest, PendingRequest, ParsedCookie } from '../../../src/features/api-checker/types';
import { DebuggerManager } from './debugger-manager';

const MAX_RESPONSE_BODY_SIZE = 1024 * 1024; // 1MB
const MAX_REQUESTS = 5000;
const BATCH_INTERVAL = 100; // ms
const BODY_TIMEOUT = 5000; // 5s

interface CDPRequestWillBeSent {
  requestId: string;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    postData?: string;
  };
  timestamp: number;
  type: string;
}

interface CDPResponseReceived {
  requestId: string;
  response: {
    url: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
  };
  timestamp: number;
  type: string;
}

interface CDPLoadingFinished {
  requestId: string;
  timestamp: number;
  encodedDataLength: number;
}

export class NetworkMonitor {
  private debuggerManager: DebuggerManager;
  private pendingRequests = new Map<string, PendingRequest>();
  private capturedRequests: CapturedRequest[] = [];
  private batchBuffer: CapturedRequest[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private onRequestsCaptured: ((requests: CapturedRequest[]) => void) | null = null;
  private recording = false;

  constructor(debuggerManager: DebuggerManager) {
    this.debuggerManager = debuggerManager;

    chrome.debugger.onEvent.addListener((_source, method, params) => {
      if (!this.recording) return;

      switch (method) {
        case 'Network.requestWillBeSent':
          this.handleRequestWillBeSent(params as unknown as CDPRequestWillBeSent);
          break;
        case 'Network.responseReceived':
          this.handleResponseReceived(params as unknown as CDPResponseReceived);
          break;
        case 'Network.loadingFinished':
          this.handleLoadingFinished(params as unknown as CDPLoadingFinished);
          break;
        case 'Network.loadingFailed':
          this.handleLoadingFailed(params as unknown as { requestId: string });
          break;
      }
    });
  }

  onCapture(callback: (requests: CapturedRequest[]) => void) {
    this.onRequestsCaptured = callback;
  }

  startRecording() {
    this.recording = true;
  }

  stopRecording() {
    this.recording = false;
    this.pendingRequests.clear();
    this.flushBatch();
  }

  clearRequests() {
    this.capturedRequests = [];
    this.pendingRequests.clear();
    this.batchBuffer = [];
  }

  getRequests(): CapturedRequest[] {
    return this.capturedRequests;
  }

  private handleRequestWillBeSent(params: CDPRequestWillBeSent) {
    const { requestId, request, timestamp, type } = params;

    // Only capture XHR and Fetch
    if (type !== 'XHR' && type !== 'Fetch') return;

    this.pendingRequests.set(requestId, {
      requestId,
      timestamp: timestamp * 1000,
      method: request.method,
      url: request.url,
      requestHeaders: request.headers,
      requestBody: request.postData ?? null,
      resourceType: type,
    });
  }

  private handleResponseReceived(params: CDPResponseReceived) {
    const { requestId, response, timestamp } = params;
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    let path = '';
    let queryString = '';
    try {
      const url = new URL(response.url);
      path = url.pathname;
      queryString = url.search;
    } catch { /* invalid URL */ }

    const cookies = this.parseCookies(response.headers['set-cookie'] || '');

    const captured: CapturedRequest = {
      id: requestId,
      timestamp: pending.timestamp,
      method: pending.method,
      url: response.url,
      path,
      queryString,
      requestHeaders: pending.requestHeaders,
      responseHeaders: response.headers,
      requestBody: pending.requestBody,
      responseBody: null,
      responseBodyTruncated: false,
      statusCode: response.status,
      statusText: response.statusText,
      duration: (timestamp * 1000) - pending.timestamp,
      resourceType: pending.resourceType,
      cookies,
      matchResult: null,
    };

    this.capturedRequests.push(captured);

    // Ring buffer
    if (this.capturedRequests.length > MAX_REQUESTS) {
      this.capturedRequests.shift();
    }

    // Batch IMMEDIATELY so the request appears in the UI without waiting for body
    this.batchBuffer.push(captured);
    this.scheduleBatchFlush();
  }

  private async handleLoadingFinished(params: CDPLoadingFinished) {
    const { requestId } = params;
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    const captured = this.capturedRequests.find(r => r.id === requestId);
    if (!captured) return;

    // Get response body with timeout to prevent hanging
    try {
      const result = await Promise.race([
        this.debuggerManager.sendCommand('Network.getResponseBody', { requestId }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), BODY_TIMEOUT)),
      ]) as { body: string; base64Encoded: boolean };

      if (result) {
        const body = result.base64Encoded
          ? atob(result.body)
          : result.body;

        if (body.length > MAX_RESPONSE_BODY_SIZE) {
          captured.responseBody = body.substring(0, MAX_RESPONSE_BODY_SIZE);
          captured.responseBodyTruncated = true;
        } else {
          captured.responseBody = body;
        }

        // Send update with body data
        this.batchBuffer.push(captured);
        this.scheduleBatchFlush();
      }
    } catch {
      // Response body may not be available or timed out — request is already visible in UI
    }

    this.pendingRequests.delete(requestId);
  }

  private handleLoadingFailed(params: { requestId: string }) {
    this.pendingRequests.delete(params.requestId);
  }

  private scheduleBatchFlush() {
    if (this.batchTimer) return;
    this.batchTimer = setTimeout(() => this.flushBatch(), BATCH_INTERVAL);
  }

  private flushBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.batchBuffer.length > 0) {
      const batch = [...this.batchBuffer];
      this.batchBuffer = [];
      this.onRequestsCaptured?.(batch);
    }
  }

  private parseCookies(setCookieHeader: string): ParsedCookie[] {
    if (!setCookieHeader) return [];

    return setCookieHeader.split(/,(?=\s*\w+=)/).map(cookie => {
      const parts = cookie.trim().split(';');
      const [nameValue, ...attributes] = parts;
      const eqIndex = nameValue.indexOf('=');
      const name = nameValue.substring(0, eqIndex).trim();
      const value = nameValue.substring(eqIndex + 1).trim();

      const parsed: ParsedCookie = { name, value };

      for (const attr of attributes) {
        const [key, val] = attr.trim().split('=').map(s => s.trim());
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'domain') parsed.domain = val;
        else if (lowerKey === 'path') parsed.path = val;
        else if (lowerKey === 'expires') parsed.expires = val;
        else if (lowerKey === 'httponly') parsed.httpOnly = true;
        else if (lowerKey === 'secure') parsed.secure = true;
        else if (lowerKey === 'samesite') parsed.sameSite = val;
      }

      return parsed;
    });
  }
}
