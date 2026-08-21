/**
 * B-Attend session — signed HttpOnly cookie using jose JWT.
 *
 * Session payload: { sub, role, kind, tenantId?, name, email }
 *   - kind: "platform" | "tenant"
 *   - role: PlatformRole | TenantUserRole
 *
 * Lifetime: 7 days. Refreshed on each getSession() call if close to expiry.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "battend_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
const MOBILE_TOKEN_AUDIENCE = "battend-staff-mobile";

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-secret-change-me-in-production-please-use-32+chars"
);

export type SessionKind = "platform" | "tenant";

export interface SessionPayload {
  sub: string;
  kind: SessionKind;
  role: string;
  name: string;
  email: string;
  tenantId?: string;
}

export interface SessionTokenPayload extends SessionPayload {
  iat: number;
  exp: number;
}

export type SessionData = SessionPayload;

async function sign(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret);
}

async function verify(token: string): Promise<SessionTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionTokenPayload;
  } catch {
    return null;
  }
}

/** Issues a bearer token for the native employee application, never a browser cookie. */
export async function createMobileSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload, channel: "mobile" })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(MOBILE_TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret);
}

/** Verifies that a token was issued specifically for B-Attend Staff. */
export async function verifyMobileSessionToken(token: string): Promise<SessionTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { audience: MOBILE_TOKEN_AUDIENCE });
    if (payload.channel !== "mobile") return null;
    return payload as unknown as SessionTokenPayload;
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await sign(payload);
  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionTokenPayload | null> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verify(token);
}

export async function requireSession(): Promise<SessionTokenPayload> {
  const s = await getSession();
  if (!s) {
    throw new Error("UNAUTHENTICATED");
  }
  return s;
}

export async function requirePlatformRole(...roles: string[]): Promise<SessionTokenPayload> {
  const s = await requireSession();
  if (s.kind !== "platform") {
    throw new Error("FORBIDDEN");
  }
  if (roles.length > 0 && !roles.includes(s.role)) {
    throw new Error("FORBIDDEN");
  }
  return s;
}

export async function requireTenantSession(): Promise<SessionTokenPayload> {
  const s = await requireSession();
  if (s.kind !== "tenant" || !s.tenantId) {
    throw new Error("FORBIDDEN");
  }
  return s;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
