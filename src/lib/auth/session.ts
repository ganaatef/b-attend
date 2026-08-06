/**
 * B-Attend session — signed HttpOnly cookie using jose JWT.
 *
 * Session payload: { sub, role, kind, tenantId?, name, email, sessionVersion }
 *   - kind: "platform" | "tenant"
 *   - role: PlatformRole | TenantUserRole
 *   - sessionVersion: bumped to invalidate all sessions
 *
 * Lifetime: 7 days.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "battend_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SESSION_VERSION = 1;

function getSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET must be set in production. Generate a 32+ character secret and set it as an environment variable."
      );
    }
    console.warn(
      "[auth] WARNING: SESSION_SECRET is not set. Using an insecure default for development only. Do NOT use in production."
    );
    return new TextEncoder().encode("dev-secret-change-me-in-production-please-use-32+chars");
  }
  return new TextEncoder().encode(raw);
}

export type SessionKind = "platform" | "tenant";

export interface SessionPayload {
  sub: string;
  kind: SessionKind;
  role: string;
  name: string;
  email: string;
  tenantId?: string;
  sessionVersion?: number;
}

export interface SessionTokenPayload extends SessionPayload {
  iat: number;
  exp: number;
}

export type SessionData = SessionPayload;

async function sign(payload: SessionPayload): Promise<string> {
  const secret = getSecret();
  return new SignJWT({ ...payload, sessionVersion: SESSION_VERSION })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret);
}

async function verify(token: string): Promise<SessionTokenPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret);
    const typed = payload as unknown as SessionTokenPayload;
    if (typed.sessionVersion !== undefined && typed.sessionVersion < SESSION_VERSION) {
      return null;
    }
    return typed;
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
