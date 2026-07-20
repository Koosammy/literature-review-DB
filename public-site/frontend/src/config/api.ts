const DEFAULT_PUBLIC_API_URL = 'https://literature-public-backend.onrender.com';

const configuredApiUrl = process.env.REACT_APP_API_URL;

export const API_BASE_URL = configuredApiUrl || (
  process.env.NODE_ENV === 'production' ? DEFAULT_PUBLIC_API_URL : 'http://localhost:8000'
);

export const cleanBaseUrl = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL.replace(/\/$/, '');

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBaseUrl}${normalizedPath}`;
}
