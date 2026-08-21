/**
 * Distributed sliding-window rate limiter for Next.js middleware.
 *
 * Production deployments should set UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN so multiple app instances share counters.
 * Without those variables, the in-memory fallback remains useful for local
 * development but is not a substitute for a shared production store.
 */

interface WindowBucket {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

const store = new Map<string, WindowBucket>();
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, bucket] of store) {
    if (now > bucket.resetAt) store.delete(key);
  }
}

function categoryForPath(path: string): string {
  if (path.startsWith("/api/auth/")) return "auth";
  if (path.startsWith("/api/")) return "api";
  return "general";
}

function checkRateLimitLocal(ip: string, category: string, limit: number, windowMs: number): RateLimitResult {
  cleanup();
  const key = `${ip}:${category}`;
  const now = Date.now();
  let bucket = store.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    store.set(key, bucket);
  }

  bucket.count++;
  if (bucket.count > limit) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }
  return { allowed: true, remaining: limit - bucket.count, retryAfterMs: 0 };
}

async function checkRateLimitRedis(ip: string, category: string, limit: number, windowMs: number): Promise<RateLimitResult | null> {
  const endpoint = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!endpoint || !token) return null;

  const now = Date.now();
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const windowId = Math.floor(now / windowMs);
  const key = `battend:ratelimit:${category}:${windowId}:${ip}`;

  try {
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, windowSeconds + 5],
      ]),
      signal: AbortSignal.timeout(1000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as Array<{ result?: number | string; error?: string }>;
    const count = Number(payload[0]?.result);
    if (!Number.isFinite(count)) return null;

    const windowEndsAt = (windowId + 1) * windowMs;
    if (count > limit) {
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, windowEndsAt - now) };
    }
    return { allowed: true, remaining: Math.max(0, limit - count), retryAfterMs: 0 };
  } catch {
    // Fail open to the local limiter so a temporary rate-limit store outage
    // does not take down the application. Alerting should monitor this path.
    return null;
  }
}

export async function checkRateLimit(
  ip: string,
  path: string,
  limit: number,
  windowMs = 60_000,
): Promise<RateLimitResult> {
  const category = categoryForPath(path);
  return (await checkRateLimitRedis(ip, category, limit, windowMs))
    ?? checkRateLimitLocal(ip, category, limit, windowMs);
}

export function getRateLimitHeaders(
  limit: number,
  remaining: number,
  retryAfterMs: number,
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, remaining)),
  };
  if (retryAfterMs > 0) headers["Retry-After"] = String(Math.ceil(retryAfterMs / 1000));
  return headers;
}

export const RATE_LIMITS = {
  general: 120,
  api: 60,
  auth: 10,
} as const;
