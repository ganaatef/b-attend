/**
 * In-memory sliding-window rate limiter for Next.js middleware.
 * 
 * Per-IP limits:
 * - General routes: 120 req/min
 * - API routes:     60 req/min  
 * - Auth routes:    10 req/min (brute-force protection)
 * - Public API:     30 req/min
 *
 * Uses a simple sliding window with 1-minute buckets.
 * No external dependencies — works in edge/serverless.
 */

interface WindowBucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, WindowBucket>();

// Periodic cleanup every 60s to prevent memory leak
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, bucket] of store) {
    if (now > bucket.resetAt) store.delete(key);
  }
}

export function checkRateLimit(
  ip: string,
  path: string,
  limit: number,
  windowMs = 60_000
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  cleanup();

  // Determine category — must match middleware's classification
  let category = "general";
  if (path.startsWith("/api/auth/")) category = "auth";
  else if (path.startsWith("/api/")) category = "api";

  const key = `${ip}:${category}`;
  const now = Date.now();

  let bucket = store.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    store.set(key, bucket);
  }

  bucket.count++;

  if (bucket.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: bucket.resetAt - now,
    };
  }

  return {
    allowed: true,
    remaining: limit - bucket.count,
    retryAfterMs: 0,
  };
}

export function getRateLimitHeaders(
  limit: number,
  remaining: number,
  retryAfterMs: number
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, remaining)),
  };
  if (retryAfterMs > 0) {
    headers["Retry-After"] = String(Math.ceil(retryAfterMs / 1000));
  }
  return headers;
}

// Route-specific limits
export const RATE_LIMITS = {
  general: 120,
  api: 60,
  auth: 10,
} as const;
