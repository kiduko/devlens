import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseSwaggerFromObject } from '../../src/features/api-checker/services/swagger-parser';

describe('parseSwaggerFromObject', () => {
  it('parses Swagger 2.0 spec', async () => {
    const raw = JSON.parse(
      readFileSync(resolve(__dirname, '../fixtures/petstore-v2.json'), 'utf-8'),
    );
    const spec = await parseSwaggerFromObject(raw);

    expect(spec.id).toBeDefined();
    expect(spec.title).toBe('Petstore');
    expect(spec.version).toBe('1.0.0');
    expect(spec.basePath).toBe('/v2');
    expect(spec.endpoints.length).toBeGreaterThanOrEqual(4);

    const listPets = spec.endpoints.find(e => e.operationId === 'listPets');
    expect(listPets).toBeDefined();
    expect(listPets!.method).toBe('GET');
    expect(listPets!.path).toBe('/pets');
    expect(listPets!.tags).toContain('pets');
  });

  it('parses OpenAPI 3.0 spec', async () => {
    const raw = JSON.parse(
      readFileSync(resolve(__dirname, '../fixtures/petstore-v3.json'), 'utf-8'),
    );
    const spec = await parseSwaggerFromObject(raw);

    expect(spec.title).toBe('Petstore v3');
    expect(spec.version).toBe('2.0.0');
    expect(spec.basePath).toBe('/v3');
    expect(spec.endpoints.length).toBe(2);

    const getPet = spec.endpoints.find(e => e.operationId === 'getPet');
    expect(getPet).toBeDefined();
    expect(getPet!.method).toBe('GET');
    expect(getPet!.path).toBe('/pets/{petId}');
  });

  it('extracts parameters correctly from v2', async () => {
    const raw = JSON.parse(
      readFileSync(resolve(__dirname, '../fixtures/petstore-v2.json'), 'utf-8'),
    );
    const spec = await parseSwaggerFromObject(raw);

    const listPets = spec.endpoints.find(e => e.operationId === 'listPets')!;
    expect(listPets.parameters).toContainEqual(
      expect.objectContaining({ name: 'limit', in: 'query' }),
    );
  });

  it('extracts request body from v2', async () => {
    const raw = JSON.parse(
      readFileSync(resolve(__dirname, '../fixtures/petstore-v2.json'), 'utf-8'),
    );
    const spec = await parseSwaggerFromObject(raw);

    const createPet = spec.endpoints.find(e => e.operationId === 'createPet')!;
    expect(createPet.requestBody).toBeDefined();
    expect(createPet.requestBody!.required).toBe(true);
  });

  it('infers basePath from sourceUrl when endpoints lack the prefix', async () => {
    const raw = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0.0' },
      paths: {
        '/storage/files': { get: { responses: { '200': { description: 'OK' } } } },
      },
    };
    const spec = await parseSwaggerFromObject(raw, 'https://api.example.com/v4/drive/openapi');

    expect(spec.basePath).toBe('/v4/drive');
  });

  it('does NOT set basePath when endpoints already include the URL prefix', async () => {
    const raw = {
      openapi: '3.0.0',
      info: { title: 'Media API', version: '2.0.0' },
      paths: {
        '/v4/media/creagen/generate': { post: { responses: { '200': { description: 'OK' } } } },
        '/v4/media/creagen/gen/result/{id}/download-count': { post: { responses: { '200': { description: 'OK' } } } },
      },
    };
    const spec = await parseSwaggerFromObject(raw, 'https://api-cdn.vcatwork.net/v4/media/openapi');

    expect(spec.basePath).toBe('');
    expect(spec.endpoints.length).toBe(2);
  });
});
