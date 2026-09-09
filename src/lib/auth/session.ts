/**
 * B-Attend session — signed HttpOnly browser cookie plus a separately-audienced
 * native employee bearer token.
 *
 * Browser tenant sessions are validated against BOTH the live user identity and
 * the live tenant/subscription state. Suspending/deleting a user therefore
 * revokes their browser access immediately even if the signed cookie has not
 * expired. Recovery sessions bypass billing state only; they never bypass user
 * suspension/deletion.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { isTenantOperationalState } from "@/lib/auth/subscription-state";

const COOKIE_NAME = "battend_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const SESSION_VERSION = 1;
const MOBILE_TOKEN_AUDIENCE = "battend-staff-mobile";

function getSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set in production. Generate a 32+ character secret and set it as an environment variable.");
    }
    console.warn("[auth] WARNING: SESSION_SECRET is not set. Using an insecure default for development only. Do NOT use in production.");
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
  return new SignJWT({ ...payload, sessionVersion: SESSION_VERSION })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

async function verify(token: string): Promise<SessionTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const typed = payload as unknown as SessionTokenPayload;
    if (typed.sessionVersion !== undefined && typed.sessionVersion < SESSION_VERSION) return null;
    return typed;
  } catch {
    return null;
  }
}

/** Issues a bearer token specifically for the native employee application. */
export async function createMobileSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload, sessionVersion: SESSION_VERSION, channel: "mobile" })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(MOBILE_TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyMobileSessionToken(token: string): Promise<SessionTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { audience: MOBILE_TOKEN_AUDIENCE });
    if (payload.channel !== "mobile") return null;
    const typed = payload as unknown as SessionTokenPayload;
    if (typed.sessionVersion !== undefined && typed.sessionVersion < SESSION_VERSION) return null;
    return typed;
  } catch {
    return null;
  }
}

async function readVerifiedCookie(): Promise<SessionTokenPayload | null> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verify(token);
}

async function isActiveTenantIdentity(session: SessionTokenPayload): Promise<boolean> {
  if (session.kind !== "tenant") return true;
  if (!session.tenantId) return false;

  const user = await db.user.findFirst({
    where: {
      id: session.sub,
      companyId: session.tenantId,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { id: true },
  });
  return Boolean(user);
}

async function isOperationalTenantSession(session: SessionTokenPayload): Promise<boolean> {
  if (session.kind !== "tenant") return true;
  if (!session.tenantId) return false;

  const tenant = await db.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      deletedAt: true,
      status: true,
      subscription: {
        select: {
          status: true,
          trialEndsAt: true,
          graceEndsAt: true,
          currentPeriodEnd: true,
        },
      },
    },
  });
  return Boolean(tenant && isTenantOperationalState(tenant));
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

/** Normal application access: identity + subscription must both be active. */
export async function getSession(): Promise<SessionTokenPayload | null> {
  const session = await readVerifiedCookie();
  if (!session) return null;
  if (session.kind !== "tenant") return session;
  const [identityActive, operational] = await Promise.all([
    isActiveTenantIdentity(session),
    isOperationalTenantSession(session),
  ]);
  return identityActive && operational ? session : null;
}

/**
 * Billing/support recovery access. This bypasses subscription state only. A
 * suspended/deleted tenant user can never use a recovery session.
 */
export async function getSessionAllowInactive(): Promise<SessionTokenPayload | null> {
  const session = await readVerifiedCookie();
  if (!session) return null;
  if (session.kind !== "tenant") return session;
  return (await isActiveTenantIdentity(session)) ? session : null;
}

export async function requireSession(): Promise<SessionTokenPayload> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHENTICATED");
  return s;
}

export async function requirePlatformRole(...roles: string[]): Promise<SessionTokenPayload> {
  const s = await requireSession();
  if (s.kind !== "platform") throw new Error("FORBIDDEN");
  if (roles.length > 0 && !roles.includes(s.role)) throw new Error("FORBIDDEN");
  return s;
}

export async function requireTenantSession(): Promise<SessionTokenPayload> {
  const s = await requireSession();
  if (s.kind !== "tenant" || !s.tenantId) throw new Error("FORBIDDEN");
  return s;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
