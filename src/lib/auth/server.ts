// ===================================================================
// Server-side authorization & tenant-scoping helpers.
// -------------------------------------------------------------------
// All functions here MUST be called from Server Components, Route
// Handlers, or Server Actions ONLY (they read cookies via next/headers).
// Never call from client components.
//
// Authentication, tenant scope, subscription state, role, and capability
// checks are enforced here for server-side callers.
// ===================================================================

import { redirect } from "next/navigation";
import { getSession, type SessionData } from "./session";
import { requireActiveSubscription as checkTenantSubscription } from "./tenant";
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

// ---- Tenant helpers ----------------------------------------------

/** Returns the current tenant companyId from the authenticated session. */
export async function getTenantId(): Promise<string> {
  const s = await requireSession();
  if (s.kind !== "tenant" || !s.tenantId) {
    throw new Error("Tenant scope required for this operation.");
  }
  return s.tenantId;
}

/** Checks the tenant subscription state before an operational mutation. */
export async function requireActiveSubscription(tenantId: string): Promise<boolean> {
  return checkTenantSubscription(tenantId);
}

/** Checks that the current authenticated session is a tenant with one of the supplied roles. */
export async function requireTenantRole(...roles: string[]): Promise<boolean> {
  const s = await requireSession();
  return s.kind === "tenant" && (roles.length === 0 || roles.includes(s.role));
}

const ROLE_CAPABILITIES: Record<string, readonly Capability[]> = {
  COMPANY_OWNER: CAPABILITIES,
  HR_ADMIN: CAPABILITIES.filter((cap) => cap !== "MANAGE_BILLING" && cap !== "MANAGE_ROLES"),
  BRANCH_MANAGER: ["VIEW_DASHBOARD", "CLOCK_SELF", "USE_KIOSK", "VIEW_LIVE_ATTENDANCE", "MANAGE_APPROVALS", "VIEW_REPORTS"],
  EMPLOYEE: ["VIEW_DASHBOARD", "CLOCK_SELF"],
};

/** Checks the current tenant role against the server-side capability map. */
export async function requirePermission(capability: Capability): Promise<boolean> {
  const s = await requireSession();
  if (s.kind !== "tenant") return false;
  return ROLE_CAPABILITIES[s.role]?.includes(capability) ?? false;
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
