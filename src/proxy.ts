/**
 * B-Attend Next.js 16 proxy — stateless route protection + distributed abuse
 * protection. Live tenant/subscription state remains a server-side authorization
 * concern so billing suspension revokes operational access centrally.
 */

import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { checkRateLimit, getRateLimitHeaders, categoryForRateLimitPath, RATE_LIMITS } from "@/lib/rate-limit";

const COOKIE_NAME = "battend_session";

function getSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set in production. Generate a 32+ character secret and set it as an environment variable.");
    }
    console.warn("[proxy] WARNING: SESSION_SECRET is not set. Using an insecure development default.");
    return new TextEncoder().encode("dev-secret-change-me-in-production-please-use-32+chars");
  }
  return new TextEncoder().encode(raw);
}

const PUBLIC_ROUTES = new Set([
  "/",
  "/pricing",
  "/features",
  "/contact",
  "/request-demo",
  "/signup",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/accept-invite",
  "/legal/privacy",
  "/legal/terms",
]);

const PUBLIC_PREFIXES = [
  "/api/health",
  "/api/public/",
  "/api/auth/",
  "/api/mobile/",
  "/legal/",
  "/_next/",
  "/favicon.ico",
  "/logo.svg",
  "/robots.txt",
];

type ProxySession = { kind: string; role: string; tenantId?: string };

async function verifyToken(token: string): Promise<ProxySession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      kind: typeof payload.kind === "string" ? payload.kind : "platform",
      role: typeof payload.role === "string" ? payload.role : "",
      tenantId: typeof payload.tenantId === "string" ? payload.tenantId : undefined,
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

function limitForPath(pathname: string) {
  const category = categoryForRateLimitPath(pathname);
  return category === "auth"
    ? RATE_LIMITS.auth
    : category === "kiosk"
      ? RATE_LIMITS.kiosk
      : category === "api"
        ? RATE_LIMITS.api
        : RATE_LIMITS.general;
}

function withRateHeaders(response: NextResponse, remaining: number) {
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}

function apiUnauthorized(status: 401 | 403, remaining: number) {
  return withRateHeaders(
    NextResponse.json({ error: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN" }, { status }),
    remaining,
  );
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const limit = limitForPath(pathname);
  const rl = await checkRateLimit(getClientIp(req), pathname, limit);

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: getRateLimitHeaders(limit, 0, rl.retryAfterMs),
      },
    );
  }

  if (PUBLIC_ROUTES.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return withRateHeaders(NextResponse.next(), rl.remaining);
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;
  const isApi = pathname.startsWith("/api/");

  if (!session) {
    if (isApi) return apiUnauthorized(401, rl.remaining);
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin")) {
    if (session.kind !== "platform") {
      if (isApi) return apiUnauthorized(403, rl.remaining);
      const home = req.nextUrl.clone();
      home.pathname = "/dashboard";
      home.search = "";
      return NextResponse.redirect(home);
    }
    return withRateHeaders(NextResponse.next(), rl.remaining);
  }

  if (pathname === "/change-password") {
    return withRateHeaders(NextResponse.next(), rl.remaining);
  }

  if (session.kind !== "tenant" || !session.tenantId) {
    if (isApi) return apiUnauthorized(403, rl.remaining);
    const home = req.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return withRateHeaders(NextResponse.next(), rl.remaining);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg|robots.txt).*)"],
};
