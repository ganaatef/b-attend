// ===================================================================
// Server-side authorization & tenant-scoping helpers.
// -------------------------------------------------------------------
// All functions here MUST be called from Server Components, Route
// Handlers, or Server Actions ONLY (they read cookies via next/headers).
// Never call from client components.
//
// Phase 1 scope:
//   - requireSession / getSession work fully.
//   - requirePlatformRole is enforced.
//   - getTenantId returns session.tenantId (or throws).
//   - requireActiveSubscription is a STUB that returns true — real
//     enforcement arrives in Phase 2/7 per spec.
//   - requireTenantRole / requirePermission are STUBS — define the
//     capability set but defer enforcement to later phases.
// ===================================================================

import { redirect } from "next/navigation";
import { getSession, type SessionData } from "./session";
import type { PlatformRole } from "@prisma/client";

// ---- Capabilities (spec lines 664-682) ---------------------------
export const CAPABILITIES = [
  "VIEW_DASHBOARD",
  "MANAGE_BRANCHES",
  "MANAGE_EMPLOYEES",
  "MANAGE_SHIFT_POLICIES",
  "MANAGE_SCHEDULES",
  "CLOCK_SELF",
  "USE_KIOSK",
  "VIEW_LIVE_ATTENDANCE",
  "MANAGE_APPROVALS",
  "VIEW_REPORTS",
  "EXPORT_REPORTS",
  "VIEW_AUDIT_LOG",
  "MANAGE_SETTINGS",
  "VIEW_BILLING",
  "MANAGE_BILLING",
  "MANAGE_USERS",
  "MANAGE_ROLES",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

// ---- Session helpers ----------------------------------------------

/**
 * Returns the current session, or null if not authenticated.
 * Use this in routes that allow both authed and anonymous.
 */
export async function getSessionOrNull(): Promise<SessionData | null> {
  return getSession();
}

/**
 * Returns the current session, or redirects to /login.
 */
export async function requireSession(): Promise<SessionData> {
  const s = await getSession();
  if (!s) redirect("/login?reason=unauthenticated");
  return s;
}

/**
 * Returns the current platform session if scope==="platform".
 */
export async function getPlatformSessionOrNull(): Promise<SessionData | null> {
  const s = await getSession();
  if (!s || s.kind !== "platform") return null;
  return s;
}

/**
 * Ensures the current session is a platform user with one of the
 * allowed roles. Otherwise redirects to /login (or /admin if already
 * a platform user without sufficient permissions).
 */
export async function requirePlatformRole(
  ...roles: PlatformRole[]
): Promise<SessionData> {
  const s = await requireSession();
  if (s.kind !== "platform") {
    // tenant user trying to access /admin → redirect to their dashboard
    redirect("/dashboard");
  }
  if (!roles.includes(s.role as PlatformRole)) {
    // Authenticated platform user without permission → bounce to /admin
    redirect("/admin?reason=forbidden");
  }
  return s;
}

// ---- Tenant helpers (Phase 1: scaffolding only) ------------------

/**
 * Returns the current tenant companyId from the session, or throws.
 * For Phase 1, tenant logins are NOT wired up (no tenant User auth
 * yet — that arrives in Phase 3). This helper exists so Phase 2+
 * code can rely on it.
 */
export async function getTenantId(): Promise<string> {
  const s = await requireSession();
  if (s.kind !== "tenant" || !s.tenantId) {
    throw new Error("Tenant scope required for this operation.");
  }
  return s.tenantId;
}

/**
 * Phase 1 STUB. Returns true always. Real enforcement arrives in
 * Phase 7 per spec (subscription gating). Logs a TODO via console
 * once per process is not desirable; instead we annotate here.
 *
 * TODO(Phase 7): check subscription.status ∈ {TRIALING, ACTIVE,
 * GRACE_PERIOD} and currentPeriodEnd > now for operational routes.
 */
export async function requireActiveSubscription(
  _tenantId: string,
): Promise<boolean> {
  return true;
}

/**
 * Phase 1 STUB. Real role-based tenant enforcement arrives Phase 5+.
 * For now returns true.
 */
export async function requireTenantRole(..._roles: string[]): Promise<boolean> {
  return true;
}

/**
 * Phase 1 STUB. Real capability checks arrive Phase 5+.
 */
export async function requirePermission(_cap: Capability): Promise<boolean> {
  return true;
}

// ---- Audit helper ------------------------------------------------

/**
 * Records a platform audit log row. Used by login/signup/lead actions.
 */
export async function recordPlatformAudit(params: {
  actorId?: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId?: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  beforeData?: unknown;
  afterData?: unknown;
}): Promise<void> {
  // Lazy-import db to keep this module tree-shakeable in client bundles.
  const { db } = await import("@/lib/db");
  try {
    await db.platformAuditLog.create({
      data: {
        actorId: params.actorId ?? null,
        actorEmail: params.actorEmail,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        reason: params.reason ?? null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        beforeData: params.beforeData
          ? JSON.stringify(params.beforeData)
          : null,
        afterData: params.afterData ? JSON.stringify(params.afterData) : null,
      },
    });
  } catch (e) {
    // Never let audit failure break a user flow; log instead.
    console.error("[audit] failed to record platform audit log", e);
  }
}
