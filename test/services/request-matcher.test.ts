import { describe, it, expect } from 'vitest';
import { matchRequest } from '../../src/features/api-checker/services/request-matcher';
import type { CapturedRequest, ParsedSpec } from '../../src/features/api-checker/types';

function makeRequest(overrides: Partial<CapturedRequest> = {}): CapturedRequest {
  return {
    id: 'test-1',
    timestamp: Date.now(),
    method: 'GET',
    url: 'https://api.example.com/v2/pets',
    path: '/v2/pets',
    queryString: '',
    requestHeaders: {},
    responseHeaders: {},
    requestBody: null,
    responseBody: null,
    responseBodyTruncated: false,
    statusCode: 200,
    statusText: 'OK',
    duration: 100,
    resourceType: 'XHR',
    cookies: [],
    matchResult: null,
    ...overrides,
  };
}

const testSpec: ParsedSpec = {
  id: 'spec-1',
  title: 'Test API',
  version: '1.0.0',
  basePath: '/v2',
  endpoints: [
    {
      method: 'GET',
      path: '/pets',
      operationId: 'listPets',
      summary: 'List pets',
      tags: ['pets'],
      parameters: [],
      responses: { '200': { description: 'OK' } },
    },
    {
      method: 'POST',
      path: '/pets',
      operationId: 'createPet',
      summary: 'Create pet',
      tags: ['pets'],
      parameters: [],
      responses: { '201': { description: 'Created' } },
    },
    {
      method: 'GET',
      path: '/pets/{petId}',
      operationId: 'getPet',
      summary: 'Get pet',
      tags: ['pets'],
      parameters: [],
      responses: { '200': { description: 'OK' } },
    },
    {
      method: 'GET',
      path: '/users/{userId}/orders',
      operationId: 'listUserOrders',
      tags: ['orders'],
      parameters: [],
      responses: { '200': { description: 'OK' } },
    },
  ],
  raw: {},
};

const specs = [testSpec];

describe('matchRequest', () => {
  it('matches exact path with basePath removal', () => {
    const req = makeRequest({ method: 'GET', path: '/v2/pets' });
    const result = matchRequest(req, specs);
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe('exact');
    expect(result.endpoint?.operationId).toBe('listPets');
  });

  it('matches by method as well', () => {
    const req = makeRequest({ method: 'POST', path: '/v2/pets' });
    const result = matchRequest(req, specs);
    expect(result.matched).toBe(true);
    expect(result.endpoint?.operationId).toBe('createPet');
  });

  it('matches pattern paths with parameter extraction', () => {
    const req = makeRequest({ method: 'GET', path: '/v2/pets/123' });
    const result = matchRequest(req, specs);
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe('pattern');
    expect(result.pathParams).toEqual({ petId: '123' });
    expect(result.endpoint?.operationId).toBe('getPet');
  });

  it('matches nested pattern paths', () => {
    const req = makeRequest({ method: 'GET', path: '/v2/users/42/orders' });
    const result = matchRequest(req, specs);
    expect(result.matched).toBe(true);
    expect(result.pathParams).toEqual({ userId: '42' });
  });

  it('returns unmatched for unknown endpoints', () => {
    const req = makeRequest({ method: 'GET', path: '/v2/unknown' });
    const result = matchRequest(req, specs);
    expect(result.matched).toBe(false);
    expect(result.confidence).toBe('none');
  });

  it('returns unmatched when no specs provided', () => {
    const req = makeRequest();
    const result = matchRequest(req, []);
    expect(result.matched).toBe(false);
  });

  it('handles wrong method', () => {
    const req = makeRequest({ method: 'DELETE', path: '/v2/pets' });
    const result = matchRequest(req, specs);
    expect(result.matched).toBe(false);
  });

  it('matches across multiple specs', () => {
    const secondSpec: ParsedSpec = {
      id: 'spec-2',
      title: 'Orders API',
      version: '1.0.0',
      basePath: '/v3',
      endpoints: [
        {
          method: 'GET',
          path: '/orders',
          operationId: 'listOrders',
          tags: ['orders'],
          parameters: [],
          responses: { '200': { description: 'OK' } },
        },
      ],
      raw: {},
    };

    const req = makeRequest({ method: 'GET', path: '/v3/orders', url: 'https://api.example.com/v3/orders' });
    const result = matchRequest(req, [testSpec, secondSpec]);
    expect(result.matched).toBe(true);
    expect(result.endpoint?.operationId).toBe('listOrders');
    expect(result.endpoint?.specTitle).toBe('Orders API');
  });
});
