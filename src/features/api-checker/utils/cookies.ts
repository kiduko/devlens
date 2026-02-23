import type { ParsedCookie } from '../types';

export function parseRequestCookies(cookieHeader: string): ParsedCookie[] {
  if (!cookieHeader) return [];

  return cookieHeader.split(';').map(pair => {
    const eqIndex = pair.indexOf('=');
    const name = pair.substring(0, eqIndex).trim();
    const value = pair.substring(eqIndex + 1).trim();
    return { name, value };
  });
}
