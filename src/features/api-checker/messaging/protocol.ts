import type { CapturedRequest } from '../types';
import type { ParsedSpec, SpecGroupData } from '../types';

// Messages from sidepanel → background
export type BackgroundMessage =
  | { type: 'START_RECORDING'; tabId: number }
  | { type: 'STOP_RECORDING'; tabId: number }
  | { type: 'CLEAR_REQUESTS' }
  | { type: 'GET_RECORDING_STATE' }
  | { type: 'SET_SWAGGER_SPEC'; specs: ParsedSpec[] }
  | { type: 'GET_SWAGGER_SPEC' }
  | { type: 'GET_SPEC_GROUP_DATA' }
  | { type: 'SET_SPEC_GROUP_DATA'; data: SpecGroupData };

// Messages from background → sidepanel
export type SidepanelMessage =
  | { type: 'REQUEST_CAPTURED'; requests: CapturedRequest[] }
  | { type: 'RECORDING_STATE_CHANGED'; recording: boolean; tabId: number | null }
  | { type: 'SWAGGER_SPEC_LOADED'; specs: ParsedSpec[] }
  | { type: 'ERROR'; message: string };

// Response types for request-response pattern
export type BackgroundResponse =
  | { success: true; data?: unknown }
  | { success: false; error: string };
