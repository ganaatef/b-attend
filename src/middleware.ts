/**
 * B-Attend middleware — protects authenticated routes and routes by role.
 *
 * Public (no auth required):
 *   /, /pricing, /features, /contact, /request-demo, /signup, /login,
 *   /legal/privacy, /legal/terms, /api/public/*
 *
 * Platform (Super Admin / Sales / Support / Billing):
 *   /admin/*
 *
 * Tenant (Company Owner / HR / Branch Manager / Employee):
 *   /dashboard, /onboarding, /branches, /employees, /policies, /schedules,
 *   /clock, /kiosk, /approvals, /reports, /audit, /settings, /billing,
 *   /support, /today, /attendance, /requests, /profile, /live, /users
 *
 * Verification of the JWT happens here using jose. We do NOT fetch the DB on
 * every request — the session cookie is the source of truth.
 */

import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "battend_session";

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
    const secret = new TextEncoder().encode(
      process.env.SESSION_SECRET ?? "dev-secret-change-me-in-production-please-use-32+chars"
    );
    const { payload } = await jwtVerify(token, secret);
    return {
      kind: (payload as { kind?: string }).kind ?? "platform",
      role: (payload as { role?: string }).role ?? "",
      tenantId: (payload as { tenantId?: string }).tenantId,
    };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow /api/auth/* (login, logout handlers if any)
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
    return NextResponse.next();
  }

  // All other protected routes require tenant session
  if (session.kind !== "tenant" || !session.tenantId) {
    const home = req.nextUrl.clone();
    home.pathname = "/";
    return NextResponse.redirect(home);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match everything except:
     * - _next/static, _next/image, favicon
     * - public assets
     * - api/public/* (handled in route)
     */
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|robots.txt|api/public).*)",
  ],
};
