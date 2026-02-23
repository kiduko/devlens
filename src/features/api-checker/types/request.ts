export interface CapturedRequest {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  path: string;
  queryString: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody: string | null;
  responseBody: string | null;
  responseBodyTruncated: boolean;
  statusCode: number;
  statusText: string;
  duration: number;
  resourceType: string;
  cookies: ParsedCookie[];
  matchResult: import('./matching').MatchResult | null;
}

export interface ParsedCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
}

export interface PendingRequest {
  requestId: string;
  timestamp: number;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  resourceType: string;
}
