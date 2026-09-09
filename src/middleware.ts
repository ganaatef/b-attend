/**
 * B-Attend middleware — protects authenticated routes, routes by role, and rate limits.
 * JWT verification stays stateless; subscription state is enforced by server actions/helpers.
 */

import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";

const COOKIE_NAME = "battend_session";

function getSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set in production. Generate a 32+ character secret and set it as an environment variable.");
    }
    console.warn("[middleware] WARNING: SESSION_SECRET is not set. Using an insecure development default.");
    return new TextEncoder().encode("dev-secret-change-me-in-production-please-use-32+chars");
  }
  return new TextEncoder().encode(raw);
}

const SECRET_KEY = getSecret();

const PUBLIC_ROUTES = [
  "/",
  "/pricing",
  "/features",
  "/contact",
  "/request-demo",
  "/signup",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/legal/privacy",
  "/legal/terms",
];

const PUBLIC_PREFIXES = ["/api/health", "/api/public/", "/legal/", "/_next/", "/favicon.ico", "/logo.svg", "/robots.txt"];

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

function rateLimitForPath(pathname: string) {
  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/api/auth/")
  ) return RATE_LIMITS.auth;
  if (pathname === "/kiosk" || pathname.startsWith("/kiosk/") || pathname.startsWith("/api/kiosk/")) return RATE_LIMITS.kiosk;
  if (pathname.startsWith("/api/")) return RATE_LIMITS.api;
  return RATE_LIMITS.general;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = getClientIp(req);
  const rateLimit = rateLimitForPath(pathname);
  const rl = await checkRateLimit(ip, pathname, rateLimit);

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

  if (PUBLIC_ROUTES.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Remaining", String(rl.remaining));
    return response;
  }

  if (pathname.startsWith("/api/auth/")) {
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Remaining", String(rl.remaining));
    return response;
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;

  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin")) {
    if (session.kind !== "platform") {
      const home = req.nextUrl.clone();
      home.pathname = "/";
      return NextResponse.redirect(home);
    }
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Remaining", String(rl.remaining));
    return response;
  }

  if (pathname === "/change-password") {
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Remaining", String(rl.remaining));
    return response;
  }

  if (session.kind !== "tenant" || !session.tenantId) {
    const home = req.nextUrl.clone();
    home.pathname = "/";
    return NextResponse.redirect(home);
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Remaining", String(rl.remaining));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg|robots.txt).*)"],
};
