import { Platform } from 'react-native';

function getApiBaseOrigins(): string[] {
  const origins: string[] = [];
  const pushUnique = (origin?: string | null) => {
    if (!origin) return;
    const normalized = origin.replace(/\/$/, '');
    if (normalized && !origins.includes(normalized)) {
      origins.push(normalized);
    }
  };

  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    pushUnique(process.env.EXPO_PUBLIC_BACKEND_URL);
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      pushUnique('http://localhost:4000');
      pushUnique(window.location.origin);
    } else {
      pushUnique(window.location.origin);
    }
  } else {
    pushUnique('http://localhost:4000');
  }

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
    const isLocalOrigin =
      origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
    const timeoutMs = isLocalOrigin ? 2500 : 8000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${origin}${endpoint}${queryString}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const json = (await res.json()) as T;
        return json;
      }
    } catch {
      // Try next origin or fall back to offline cache
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return null;
}
