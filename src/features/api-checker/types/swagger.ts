export interface ParsedSpec {
  id: string;
  title: string;
  version: string;
  basePath: string;
  sourceUrl?: string;
  endpoints: ParsedEndpoint[];
  raw: unknown;
}

export interface ParsedEndpoint {
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
  tags: string[];
  parameters: EndpointParameter[];
  requestBody?: EndpointRequestBody;
  responses: Record<string, EndpointResponse>;
}

export interface EndpointParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  type?: string;
  description?: string;
}

export interface EndpointRequestBody {
  contentType: string;
  required: boolean;
  schema?: unknown;
}

export interface EndpointResponse {
  description: string;
  schema?: unknown;
}

export interface SpecGroup {
  id: string;
  name: string;
  specIds: string[];
  createdAt: number;
}

export interface SpecGroupData {
  groups: SpecGroup[];
  activeGroupId: string | null;
  specs: ParsedSpec[];
}

export interface SpecGroupExport {
  groups: SpecGroup[];
  activeGroupId: string | null;
  specSources: { id: string; sourceUrl: string }[];
}
