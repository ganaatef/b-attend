/**
 * HR authorization bridge.
 *
 * The product originally exposed a coarse HR permission enum tied directly to
 * four legacy roles. Keep that public contract while resolving authorization
 * through the enterprise IAM engine so custom tenant roles participate too.
 */

import { getSession } from "@/lib/auth/session";
import { evaluatePermission, type AuthorizationScope } from "@/lib/auth/authorization";
import type { PermissionKey } from "@/lib/auth/permission-catalog";
import { db } from "@/lib/db";

export type HrPermission =
  | "VIEW_HR_DASHBOARD"
  | "MANAGE_DEPARTMENTS"
  | "MANAGE_JOB_TITLES"
  | "VIEW_EMPLOYEE_SENSITIVE_DATA"
  | "MANAGE_CONTRACTS"
  | "MANAGE_DOCUMENTS"
  | "MANAGE_LEAVE_TYPES"
  | "MANAGE_LEAVE_BALANCES"
  | "APPROVE_LEAVE"
  | "MANAGE_WARNINGS"
  | "MANAGE_TRAINING"
  | "MANAGE_ASSETS"
  | "MANAGE_ONBOARDING"
  | "MANAGE_OFFBOARDING"
  | "VIEW_PAYROLL"
  | "MANAGE_PAYROLL"
  | "EXPORT_HR_EXCEL";

export const HR_PERMISSION_IAM_MAP: Readonly<Record<HrPermission, PermissionKey>> = {
  VIEW_HR_DASHBOARD: "hr.dashboard.view",
  MANAGE_DEPARTMENTS: "departments.manage",
  MANAGE_JOB_TITLES: "job_titles.manage",
  VIEW_EMPLOYEE_SENSITIVE_DATA: "employees.sensitive.view",
  MANAGE_CONTRACTS: "contracts.manage",
  MANAGE_DOCUMENTS: "documents.manage",
  MANAGE_LEAVE_TYPES: "leave.types.manage",
  MANAGE_LEAVE_BALANCES: "leave.balances.manage",
  APPROVE_LEAVE: "leave.approve",
  MANAGE_WARNINGS: "warnings.manage",
  MANAGE_TRAINING: "training.manage",
  MANAGE_ASSETS: "assets.manage",
  MANAGE_ONBOARDING: "onboarding.manage",
  MANAGE_OFFBOARDING: "offboarding.manage",
  VIEW_PAYROLL: "payroll.view",
  MANAGE_PAYROLL: "payroll.manage",
  EXPORT_HR_EXCEL: "hr.export",
};

// Retained for compatibility with code that still renders role-level UI. This
// is not the authoritative authorization path for server-side decisions.
const OWNER_PERMISSIONS: HrPermission[] = Object.keys(HR_PERMISSION_IAM_MAP) as HrPermission[];
const HR_ADMIN_PERMISSIONS: HrPermission[] = [...OWNER_PERMISSIONS];
const BRANCH_MANAGER_PERMISSIONS: HrPermission[] = ["VIEW_HR_DASHBOARD", "APPROVE_LEAVE", "EXPORT_HR_EXCEL"];
const EMPLOYEE_PERMISSIONS: HrPermission[] = [];

export function getRolePermissions(role: string): HrPermission[] {
  switch (role) {
    case "COMPANY_OWNER": return OWNER_PERMISSIONS;
    case "HR_ADMIN": return HR_ADMIN_PERMISSIONS;
    case "BRANCH_MANAGER": return BRANCH_MANAGER_PERMISSIONS;
    case "EMPLOYEE": return EMPLOYEE_PERMISSIONS;
    default: return [];
  }
}

export async function hasHrPermission(permission: HrPermission, scope: AuthorizationScope = {}): Promise<boolean> {
  const session = await getSession();
  if (!session || session.kind !== "tenant" || !session.tenantId) return false;
  const decision = await evaluatePermission({
    companyId: session.tenantId,
    userId: session.sub,
    legacyRole: session.role,
    permission: HR_PERMISSION_IAM_MAP[permission],
    scope,
  });
  return decision.allowed;
}

export async function requireHrPermission(permission: HrPermission, scope: AuthorizationScope = {}): Promise<void> {
  const has = await hasHrPermission(permission, scope);
  if (!has) throw new Error(`HR_PERMISSION_DENIED:${permission}`);
}

/**
 * Compatibility helper for tenant-wide HR administration. It intentionally
 * resolves through an IAM permission that branch managers do not receive.
 */
export async function requireHrAdmin(): Promise<{ tenantId: string; userId: string; role: string }> {
  const session = await getSession();
  if (!session || session.kind !== "tenant" || !session.tenantId) throw new Error("FORBIDDEN");
  const decision = await evaluatePermission({
    companyId: session.tenantId,
    userId: session.sub,
    legacyRole: session.role,
    permission: "employees.sensitive.view",
  });
  if (!decision.allowed) throw new Error("FORBIDDEN");
  return { tenantId: session.tenantId, userId: session.sub, role: session.role };
}

/**
 * Transitional pure-role helper used by a few callers that only have a role
 * value. Server actions should use hasHrPermission/evaluatePermission instead.
 */
export async function canViewSalary(session: { role: string }): Promise<boolean> {
  return session.role === "COMPANY_OWNER" || session.role === "HR_ADMIN";
}

export async function getManagedBranchIds(userId: string, tenantId: string): Promise<string[]> {
  const branches = await db.branch.findMany({ where: { companyId: tenantId, managerId: userId, deletedAt: null } });
  return branches.map((b) => b.id);
}
