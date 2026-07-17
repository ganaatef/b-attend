/**
 * Server-side role gate helpers.
 * Use at the top of page components to enforce access control.
 */
import { getSession, type SessionTokenPayload } from "@/lib/auth/session";

type TenantSession = SessionTokenPayload & { kind: "tenant"; tenantId: string };

/**
 * Require any manager role (COMPANY_OWNER, HR_ADMIN, BRANCH_MANAGER).
 * Blocks EMPLOYEE.
 */
export async function requireManager(): Promise<TenantSession | null> {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  return session as TenantSession;
}

/**
 * Require OWNER or HR_ADMIN only. Blocks BRANCH_MANAGER and EMPLOYEE.
 */
export async function requireHrOrOwner(): Promise<TenantSession | null> {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role !== "COMPANY_OWNER" && session.role !== "HR_ADMIN") return null;
  return session as TenantSession;
}

/**
 * Require COMPANY_OWNER only.
 */
export async function requireOwner(): Promise<TenantSession | null> {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role !== "COMPANY_OWNER") return null;
  return session as TenantSession;
}
