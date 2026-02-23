export interface MatchResult {
  matched: boolean;
  endpoint: MatchedEndpoint | null;
  pathParams: Record<string, string>;
  confidence: 'exact' | 'pattern' | 'none';
}

export interface MatchedEndpoint {
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
  tags: string[];
  specTitle?: string;
}
