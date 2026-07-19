/**
 * B-Attend middleware — protects authenticated routes, routes by role, and rate limits.
 *
 * Rate limits (per IP, sliding window 1 min):
 * - General: 120 req/min
 * - API routes: 60 req/min
 * - Auth routes: 10 req/min (brute-force protection)
 *
 * Verification of the JWT happens here using jose. We do NOT fetch the DB on
 * every request — the session cookie is the source of truth.
 */

import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";

const COOKIE_NAME = "battend_session";

// Memoize the encoded secret — avoid re-creating on every request
const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-secret-change-me-in-production-please-use-32+chars"
);

const PUBLIC_ROUTES = [
  "/",
  "/pricing",
  "/features",
  "/contact",
  "/request-demo",
  "/signup",
  "/login",
  "/legal/privacy",
  "/legal/terms",
];

const PUBLIC_PREFIXES = ["/api/public/", "/legal/", "/_next/", "/favicon.ico", "/logo.svg", "/robots.txt"];

async function verifyToken(token: string): Promise<{ kind: string; role: string; tenantId?: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return {
      kind: (payload as { kind?: string }).kind ?? "platform",
      role: (payload as { role?: string }).role ?? "",
      tenantId: (payload as { tenantId?: string }).tenantId,
    };
  } catch {
    return null;
  }
}

function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = getClientIp(req);

  // ── Rate limiting ──
  let rateLimit: number = RATE_LIMITS.general;
  if (pathname.startsWith("/api/auth/")) rateLimit = RATE_LIMITS.auth;
  else if (pathname.startsWith("/api/")) rateLimit = RATE_LIMITS.api;

  const rl = checkRateLimit(ip, pathname, rateLimit);
  if (!rl.allowed) {
    return new NextResponse(JSON.stringify({ error: "Too many requests. Please try again later." }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
        ...getRateLimitHeaders(rateLimit, 0, rl.retryAfterMs),
      },
    });
  }

  // Allow public routes
  if (PUBLIC_ROUTES.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow /api/auth/* (login, logout handlers)
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;

  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // /admin/* requires platform session
  if (pathname.startsWith("/admin")) {
    if (session.kind !== "platform") {
      const home = req.nextUrl.clone();
      home.pathname = "/";
      return NextResponse.redirect(home);
    }
    const res = NextResponse.next();
    res.headers.set("X-RateLimit-Remaining", String(rl.remaining));
    return res;
  }

  // All other protected routes require tenant session
  if (session.kind !== "tenant" || !session.tenantId) {
    const home = req.nextUrl.clone();
    home.pathname = "/";
    return NextResponse.redirect(home);
  }

  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Remaining", String(rl.remaining));
  return res;
}

export const config = {
  matcher: [
    /*
     * Match everything except:
     * - _next/static, _next/image, favicon
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|robots.txt).*)",
  ],
};
