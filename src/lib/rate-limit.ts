interface RateLimitEntry {
  count: number;
  lastRefill: number;
}

const store = new Map<string, RateLimitEntry>();

const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX_REQUESTS = 60;

function cleanKey(ip: string, endpoint: string): string {
  return `${ip}:${endpoint}`;
}

function refill(entry: RateLimitEntry, windowMs: number): void {
  const now = Date.now();
  const elapsed = now - entry.lastRefill;
  if (elapsed >= windowMs) {
    entry.count = 0;
    entry.lastRefill = now;
  }
}

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
}

export function rateLimit(
  ip: string,
  endpoint: string,
  opts: RateLimitOptions = {}
): { allowed: boolean; remaining: number; resetMs: number } {
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const max = opts.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const key = cleanKey(ip, endpoint);

  let entry = store.get(key);
  if (!entry) {
    entry = { count: 0, lastRefill: Date.now() };
    store.set(key, entry);
  }

  refill(entry, windowMs);

  if (entry.count >= max) {
    const resetMs = Math.max(0, windowMs - (Date.now() - entry.lastRefill));
    return { allowed: false, remaining: 0, resetMs };
  }

  entry.count += 1;
  const remaining = max - entry.count;
  const resetMs = windowMs - (Date.now() - entry.lastRefill);
  return { allowed: true, remaining, resetMs };
}

// Cleanup stale entries every 5 minutes to prevent memory leaks
if (typeof globalThis !== "undefined") {
  setInterval(
    () => {
      const now = Date.now();
      for (const [key, entry] of store) {
        if (now - entry.lastRefill > DEFAULT_WINDOW_MS * 2) {
          store.delete(key);
        }
      }
    },
    5 * 60_000
  );
}
