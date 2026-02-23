import { describe, it, expect } from 'vitest';
import { pathToRegex, matchPath, normalizePath } from '../../src/features/api-checker/services/url-pattern-matcher';

describe('pathToRegex', () => {
  it('handles static paths', () => {
    const { regex, paramNames } = pathToRegex('/users');
    expect(paramNames).toEqual([]);
    expect(regex.test('/users')).toBe(true);
    expect(regex.test('/other')).toBe(false);
  });

  it('extracts single path parameter', () => {
    const { regex, paramNames } = pathToRegex('/users/{id}');
    expect(paramNames).toEqual(['id']);
    expect(regex.test('/users/123')).toBe(true);
    expect(regex.test('/users/')).toBe(false);
  });

  it('extracts multiple path parameters', () => {
    const { regex, paramNames } = pathToRegex('/users/{userId}/posts/{postId}');
    expect(paramNames).toEqual(['userId', 'postId']);
    expect(regex.test('/users/42/posts/99')).toBe(true);
    expect(regex.test('/users/42/posts')).toBe(false);
  });
});

describe('matchPath', () => {
  it('matches exact static paths', () => {
    const result = matchPath('/pets', '/pets');
    expect(result.matched).toBe(true);
    expect(result.params).toEqual({});
  });

  it('matches paths with parameters', () => {
    const result = matchPath('/pets/123', '/pets/{petId}');
    expect(result.matched).toBe(true);
    expect(result.params).toEqual({ petId: '123' });
  });

  it('matches paths with multiple parameters', () => {
    const result = matchPath('/users/42/orders/99', '/users/{userId}/orders/{orderId}');
    expect(result.matched).toBe(true);
    expect(result.params).toEqual({ userId: '42', orderId: '99' });
  });

  it('returns false for non-matching paths', () => {
    const result = matchPath('/users/42/profile', '/users/{id}/orders');
    expect(result.matched).toBe(false);
  });

  it('decodes URI components in parameters', () => {
    const result = matchPath('/pets/hello%20world', '/pets/{petId}');
    expect(result.matched).toBe(true);
    expect(result.params).toEqual({ petId: 'hello world' });
  });
});

describe('normalizePath', () => {
  it('removes trailing slashes', () => {
    expect(normalizePath('/users/')).toBe('/users');
    expect(normalizePath('/users///')).toBe('/users');
  });

  it('keeps root path', () => {
    expect(normalizePath('/')).toBe('/');
  });

  it('does not modify paths without trailing slashes', () => {
    expect(normalizePath('/users/123')).toBe('/users/123');
  });
});
