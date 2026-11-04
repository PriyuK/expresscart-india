import { Platform } from 'react-native';

function getApiBaseOrigins(): string[] {
  const origins: string[] = [];
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    origins.push(process.env.EXPO_PUBLIC_BACKEND_URL.replace(/\/$/, ''));
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    origins.push(window.location.origin);
  }
  origins.push('http://localhost:4000');
  return origins;
}

/**
 * Calls the ExpressCart Backend API (`/api/catalog`, `/api/auth`, `/api/family`, `/api/orders`, `/api/health`).
 * Supports a dedicated deployed Backend URL via `EXPO_PUBLIC_BACKEND_URL`, same-origin Vercel `/api/*`,
 * or local dev server (`localhost:4000`), and cleanly falls back to offline cache inside store dead-zones.
 */
export async function callBackendApi<T = any>(
  endpoint: '/api/catalog' | '/api/auth' | '/api/family' | '/api/orders' | '/api/health',
  options?: {
    method?: 'GET' | 'POST';
    query?: Record<string, string | number | undefined>;
    body?: Record<string, any>;
    isOfflineDeadZone?: boolean;
  }
): Promise<T | null> {
  if (options?.isOfflineDeadZone) {
    return null;
  }

  const method = options?.method || (options?.body ? 'POST' : 'GET');
  let queryString = '';
  if (options?.query) {
    const params = new URLSearchParams();
    Object.entries(options.query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        params.append(k, String(v));
      }
    });
    const str = params.toString();
    if (str) queryString = `?${str}`;
  }

  const origins = getApiBaseOrigins();
  for (const origin of origins) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);

      const res = await fetch(`${origin}${endpoint}${queryString}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const json = (await res.json()) as T;
        return json;
      }
    } catch {
      // Try next origin or fall back to offline cache
    }
  }

  return null;
}
