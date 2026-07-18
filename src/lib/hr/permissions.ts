/**
 * HR permissions helper.
 *
 * Permissions are capability-based, checked server-side on every HR route + action.
 */

import { getSession } from "@/lib/auth/session";
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

const OWNER_PERMISSIONS: HrPermission[] = [
  "VIEW_HR_DASHBOARD", "MANAGE_DEPARTMENTS", "MANAGE_JOB_TITLES", "VIEW_EMPLOYEE_SENSITIVE_DATA",
  "MANAGE_CONTRACTS", "MANAGE_DOCUMENTS", "MANAGE_LEAVE_TYPES", "MANAGE_LEAVE_BALANCES",
  "APPROVE_LEAVE", "MANAGE_WARNINGS", "MANAGE_TRAINING", "MANAGE_ASSETS",
  "MANAGE_ONBOARDING", "MANAGE_OFFBOARDING", "VIEW_PAYROLL", "MANAGE_PAYROLL", "EXPORT_HR_EXCEL",
];

const HR_ADMIN_PERMISSIONS: HrPermission[] = [
  "VIEW_HR_DASHBOARD", "MANAGE_DEPARTMENTS", "MANAGE_JOB_TITLES", "VIEW_EMPLOYEE_SENSITIVE_DATA",
  "MANAGE_CONTRACTS", "MANAGE_DOCUMENTS", "MANAGE_LEAVE_TYPES", "MANAGE_LEAVE_BALANCES",
  "APPROVE_LEAVE", "MANAGE_WARNINGS", "MANAGE_TRAINING", "MANAGE_ASSETS",
  "MANAGE_ONBOARDING", "MANAGE_OFFBOARDING", "VIEW_PAYROLL", "MANAGE_PAYROLL", "EXPORT_HR_EXCEL",
];

const BRANCH_MANAGER_PERMISSIONS: HrPermission[] = [
  "VIEW_HR_DASHBOARD", "APPROVE_LEAVE", "EXPORT_HR_EXCEL",
];

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

export async function hasHrPermission(permission: HrPermission): Promise<boolean> {
  const session = await getSession();
  if (!session || session.kind !== "tenant") return false;
  const perms = getRolePermissions(session.role);
  return perms.includes(permission);
}

export async function requireHrPermission(permission: HrPermission): Promise<void> {
  const has = await hasHrPermission(permission);
  if (!has) throw new Error(`HR_PERMISSION_DENIED:${permission}`);
}

export async function requireHrAdmin(): Promise<{ tenantId: string; userId: string; role: string }> {
  const session = await getSession();
  if (!session || session.kind !== "tenant" || !session.tenantId) throw new Error("FORBIDDEN");
  if (session.role !== "COMPANY_OWNER" && session.role !== "HR_ADMIN") throw new Error("FORBIDDEN");
  return { tenantId: session.tenantId, userId: session.sub, role: session.role };
}

export async function canViewSalary(session: { role: string }): Promise<boolean> {
  return session.role === "COMPANY_OWNER" || session.role === "HR_ADMIN";
}

export async function getManagedBranchIds(userId: string, tenantId: string): Promise<string[]> {
  const branches = await db.branch.findMany({ where: { companyId: tenantId, managerId: userId, deletedAt: null } });
  return branches.map((b) => b.id);
}
