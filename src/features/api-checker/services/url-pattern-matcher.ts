export interface PatternMatch {
  matched: boolean;
  params: Record<string, string>;
}

/**
 * Converts an OpenAPI path template like /users/{id}/posts/{postId}
 * into a regex pattern and extracts parameter names.
 */
export function pathToRegex(pathTemplate: string): {
  regex: RegExp;
  paramNames: string[];
} {
  const paramNames: string[] = [];

  const regexStr = pathTemplate
    .split('/')
    .map(segment => {
      const paramMatch = segment.match(/^\{(.+)\}$/);
      if (paramMatch) {
        paramNames.push(paramMatch[1]);
        return '([^/]+)';
      }
      return escapeRegex(segment);
    })
    .join('/');

  return {
    regex: new RegExp(`^${regexStr}$`),
    paramNames,
  };
}

/**
 * Matches a concrete URL path against an OpenAPI path template.
 */
export function matchPath(
  urlPath: string,
  pathTemplate: string,
): PatternMatch {
  // Try exact match first (faster)
  if (urlPath === pathTemplate) {
    return { matched: true, params: {} };
  }

  const { regex, paramNames } = pathToRegex(pathTemplate);
  const match = urlPath.match(regex);

  if (!match) {
    return { matched: false, params: {} };
  }

  const params: Record<string, string> = {};
  paramNames.forEach((name, index) => {
    params[name] = decodeURIComponent(match[index + 1]);
  });

  return { matched: true, params };
}

/**
 * Normalizes a URL path by removing trailing slashes.
 */
export function normalizePath(path: string): string {
  return path.replace(/\/+$/, '') || '/';
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
