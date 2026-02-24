import type { CapturedRequest, ParsedSpec, ParsedEndpoint, MatchResult, MatchedEndpoint } from '../types';
import { matchPath, normalizePath } from './url-pattern-matcher';

export function matchRequest(
  request: CapturedRequest,
  specs: ParsedSpec[],
): MatchResult {
  if (specs.length === 0) {
    return { matched: false, endpoint: null, pathParams: {}, confidence: 'none' };
  }

  for (const spec of specs) {
    const result = matchRequestAgainstSpec(request, spec);
    if (result.matched) {
      return result;
    }
  }

  return { matched: false, endpoint: null, pathParams: {}, confidence: 'none' };
}

function matchRequestAgainstSpec(
  request: CapturedRequest,
  spec: ParsedSpec,
): MatchResult {
  const requestPath = normalizePath(request.path);
  const requestMethod = request.method.toUpperCase();

  // Remove basePath prefix if present
  let relativePath = requestPath;
  if (spec.basePath && requestPath.startsWith(spec.basePath)) {
    relativePath = requestPath.slice(spec.basePath.length) || '/';
  }

  // Find endpoints with matching method
  const methodEndpoints = spec.endpoints.filter(e => e.method === requestMethod);

  // 1. Try exact match first
  for (const endpoint of methodEndpoints) {
    const endpointPath = normalizePath(endpoint.path);
    if (relativePath === endpointPath) {
      return {
        matched: true,
        endpoint: toMatchedEndpoint(endpoint, spec),
        pathParams: {},
        confidence: 'exact',
      };
    }
  }

  // 2. Try pattern match
  for (const endpoint of methodEndpoints) {
    const endpointPath = normalizePath(endpoint.path);
    const result = matchPath(relativePath, endpointPath);

    if (result.matched) {
      return {
        matched: true,
        endpoint: toMatchedEndpoint(endpoint, spec),
        pathParams: result.params,
        confidence: 'pattern',
      };
    }
  }

  return { matched: false, endpoint: null, pathParams: {}, confidence: 'none' };
}

export function matchRequests(
  requests: CapturedRequest[],
  specs: ParsedSpec[],
): CapturedRequest[] {
  return requests.map(req => ({
    ...req,
    matchResult: matchRequest(req, specs),
  }));
}

function toMatchedEndpoint(endpoint: ParsedEndpoint, spec: ParsedSpec): MatchedEndpoint {
  return {
    method: endpoint.method,
    path: endpoint.path,
    operationId: endpoint.operationId,
    summary: endpoint.summary,
    tags: endpoint.tags,
    specTitle: spec.title,
  };
}
