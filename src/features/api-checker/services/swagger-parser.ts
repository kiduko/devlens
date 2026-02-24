import yaml from 'js-yaml';
import type { ParsedSpec, ParsedEndpoint, EndpointParameter, EndpointRequestBody, EndpointResponse } from '../types';

export async function parseSwaggerFromUrl(url: string): Promise<ParsedSpec> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  return parseSwaggerFromText(text, url);
}

export async function parseSwaggerFromText(text: string, sourceUrl?: string): Promise<ParsedSpec> {
  let raw: unknown;

  // Try JSON first, then YAML
  try {
    raw = JSON.parse(text);
  } catch {
    raw = yaml.load(text);
  }

  return parseSwaggerFromObject(raw, sourceUrl);
}

export async function parseSwaggerFromObject(raw: unknown, sourceUrl?: string): Promise<ParsedSpec> {
  const doc = dereferenceRefs(raw as Record<string, unknown>) as Record<string, unknown>;

  const isV2 = 'swagger' in doc && String(doc.swagger).startsWith('2');

  const info = (doc.info as Record<string, string>) || {};
  const title = info.title || 'Untitled API';
  const version = info.version || '0.0.0';

  let basePath = '';
  if (isV2) {
    basePath = (doc.basePath as string) || '';
  } else {
    // OpenAPI 3.x: extract base path from servers
    const servers = doc.servers as Array<{ url: string }> | undefined;
    if (servers && servers.length > 0) {
      try {
        const serverUrl = new URL(servers[0].url);
        basePath = serverUrl.pathname.replace(/\/$/, '');
      } catch {
        basePath = servers[0].url.replace(/\/$/, '');
      }
    }
  }

  const endpoints = extractEndpoints(doc, isV2);

  // If basePath is empty and we have a sourceUrl, infer basePath from it
  // But only if the endpoint paths DON'T already include the URL prefix
  if (!basePath && sourceUrl) {
    const candidate = inferBasePathFromUrl(sourceUrl);
    if (candidate) {
      // Check: do endpoints already start with this prefix?
      const endpointsAlreadyHavePrefix = endpoints.length > 0 &&
        endpoints.some(e => e.path.startsWith(candidate));

      if (!endpointsAlreadyHavePrefix) {
        // Endpoints like /storage/files → need basePath /v4/drive
        basePath = candidate;
      }
      // else: endpoints like /v4/media/creagen/... → basePath stays empty
    }
  }

  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `spec-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return { id, title, version, basePath, sourceUrl, endpoints, raw: doc };
}

/**
 * Infer basePath candidate from the spec's source URL.
 * Strips the last segment (e.g., "openapi", "swagger.json").
 */
function inferBasePathFromUrl(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);
    const pathSegments = url.pathname.replace(/\/$/, '').split('/').filter(Boolean);

    // Remove the last segment (the doc endpoint itself)
    if (pathSegments.length > 0) {
      pathSegments.pop();
    }

    if (pathSegments.length === 0) return '';
    return '/' + pathSegments.join('/');
  } catch {
    return '';
  }
}

/**
 * Simple $ref dereferencer that resolves internal JSON references.
 * Handles #/definitions/... and #/components/schemas/... patterns.
 */
function dereferenceRefs(root: Record<string, unknown>): unknown {
  const seen = new Set<unknown>();

  function resolve(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') return obj;
    if (seen.has(obj)) return obj;
    seen.add(obj);

    if (Array.isArray(obj)) {
      return obj.map(item => resolve(item));
    }

    const record = obj as Record<string, unknown>;

    // Handle $ref
    if ('$ref' in record && typeof record.$ref === 'string') {
      const refPath = record.$ref;
      if (refPath.startsWith('#/')) {
        const resolved = getByPath(root, refPath.slice(2).split('/'));
        if (resolved !== undefined) {
          return resolve(resolved);
        }
      }
      return record;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      result[key] = resolve(value);
    }
    return result;
  }

  return resolve(root);
}

function getByPath(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const segment of path) {
    const decoded = segment.replace(/~1/g, '/').replace(/~0/g, '~');
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[decoded];
  }
  return current;
}

function extractEndpoints(
  doc: Record<string, unknown>,
  isV2: boolean,
): ParsedEndpoint[] {
  const paths = (doc.paths as Record<string, Record<string, unknown>>) || {};
  const endpoints: ParsedEndpoint[] = [];

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].indexOf(method) === -1) {
        continue;
      }

      const op = operation as Record<string, unknown>;

      const parameters = extractParameters(
        (op.parameters as Array<Record<string, unknown>>) || [],
      );

      let requestBody: EndpointRequestBody | undefined;
      if (isV2) {
        const rawBodyParam = ((op.parameters as Array<Record<string, unknown>>) || []).find(
          p => p.in === 'body',
        );
        if (rawBodyParam) {
          requestBody = {
            contentType: 'application/json',
            required: rawBodyParam.required as boolean || false,
            schema: rawBodyParam.schema,
          };
        }
      } else {
        // OpenAPI 3.x
        const rb = op.requestBody as Record<string, unknown> | undefined;
        if (rb) {
          const content = rb.content as Record<string, Record<string, unknown>> | undefined;
          if (content) {
            const contentType = Object.keys(content)[0] || 'application/json';
            requestBody = {
              contentType,
              required: (rb.required as boolean) || false,
              schema: content[contentType]?.schema,
            };
          }
        }
      }

      const responses = extractResponses(
        (op.responses as Record<string, Record<string, unknown>>) || {},
      );

      endpoints.push({
        method: method.toUpperCase(),
        path,
        operationId: op.operationId as string | undefined,
        summary: op.summary as string | undefined,
        tags: (op.tags as string[]) || [],
        parameters,
        requestBody,
        responses,
      });
    }
  }

  return endpoints;
}

function extractParameters(
  params: Array<Record<string, unknown>>,
): EndpointParameter[] {
  return params
    .filter(p => p.in !== 'body') // v2 body params handled separately
    .map(p => ({
      name: p.name as string,
      in: p.in as EndpointParameter['in'],
      required: (p.required as boolean) || false,
      type: (p.type as string) || (p.schema as Record<string, string>)?.type,
      description: p.description as string | undefined,
    }));
}

function extractResponses(
  responses: Record<string, Record<string, unknown>>,
): Record<string, EndpointResponse> {
  const result: Record<string, EndpointResponse> = {};

  for (const [status, response] of Object.entries(responses)) {
    result[status] = {
      description: (response.description as string) || '',
      schema: response.schema || (response.content as Record<string, unknown>),
    };
  }

  return result;
}
