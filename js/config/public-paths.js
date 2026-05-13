const DEFAULT_BASE_URL = './';

function normalizeBaseUrl(baseUrl) {
  const base = typeof baseUrl === 'string' && baseUrl ? baseUrl : DEFAULT_BASE_URL;
  return base.endsWith('/') ? base : `${base}/`;
}

function normalizeAssetPath(path) {
  return String(path || '').replace(/^\.?\//, '');
}

export function publicAssetUrl(path) {
  const rawPath = String(path || '');
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(rawPath)) return rawPath;

  return `${normalizeBaseUrl(import.meta.env?.BASE_URL)}${normalizeAssetPath(rawPath)}`;
}
