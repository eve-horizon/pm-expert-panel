import { execSync } from 'child_process';

const SERVICE = 'API';

let cachedApiUrl: string | undefined;

export function getApiUrl(): string {
  if (cachedApiUrl) return cachedApiUrl;

  // 1. Prefer the injected env var (set by with_apis in agents.yaml)
  const envUrl = process.env[`EVE_APP_API_URL_${SERVICE}`];
  if (envUrl) {
    cachedApiUrl = envUrl.replace(/\/$/, '');
    return cachedApiUrl;
  }

  // 2. Auto-discover via Eve CLI (available in all Eve jobs)
  try {
    const out = execSync('eve api show api --json 2>/dev/null', { encoding: 'utf8', timeout: 5000 });
    const info = JSON.parse(out);
    if (info.base_url) {
      cachedApiUrl = info.base_url.replace(/\/$/, '');
      return cachedApiUrl;
    }
  } catch { /* fall through */ }

  console.error(`Error: EVE_APP_API_URL_${SERVICE} not set and auto-discovery failed.`);
  console.error('Are you running inside an Eve job with with_apis: [api]?');
  process.exit(1);
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const url = getApiUrl();
  const token = process.env.EVE_JOB_TOKEN;
  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({} as Record<string, unknown>));
    const msg = (err as Record<string, string>).message || res.statusText;
    console.error(`${method} ${path} → ${res.status}: ${msg}`);
    process.exit(1);
  }
  const json = await res.json();
  // NestJS endpoints return data directly; unwrap { data: [...] } if present
  if (json && typeof json === 'object' && 'data' in json && Array.isArray((json as Record<string, unknown>).data)) {
    return (json as Record<string, unknown>).data as T;
  }
  return json as T;
}
