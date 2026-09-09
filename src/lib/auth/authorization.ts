import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { canUseFeature } from "@/lib/auth/tenant";
import {
  PERMISSIONS,
  SYSTEM_ROLE_CODES,
  SYSTEM_ROLE_PERMISSIONS,
  type PermissionKey,
  permissionsForLegacyRole,
} from "@/lib/auth/permission-catalog";

export type AccessScopeType = "TENANT" | "BRANCH" | "DEPARTMENT" | "SELF";

export type AuthorizationScope = {
  branchId?: string | null;
  departmentId?: string | null;
  targetUserId?: string | null;
};

export type AuthorizationDecision = {
  allowed: boolean;
  permission: PermissionKey;
  source: "owner" | "assignment" | "legacy" | "none" | "entitlement";
  matchedRoleCode?: string;
  matchedScopeType?: AccessScopeType;
  matchedScopeId?: string | null;
  reason?: string;
};

function assignmentIsActive(assignment: { expiresAt: Date | null; revokedAt: Date | null }, now: Date) {
  if (assignment.revokedAt) return false;
  if (assignment.expiresAt && assignment.expiresAt <= now) return false;
  return true;
}

export function scopeMatches(
  scopeType: AccessScopeType,
  scopeId: string | null,
  actorUserId: string,
  target: AuthorizationScope = {},
): boolean {
  if (scopeType === "TENANT") return true;
  if (scopeType === "BRANCH") return Boolean(scopeId && target.branchId && scopeId === target.branchId);
  if (scopeType === "DEPARTMENT") return Boolean(scopeId && target.departmentId && scopeId === target.departmentId);
  if (scopeType === "SELF") return Boolean(target.targetUserId && target.targetUserId === actorUserId);
  return false;
}

/**
 * Seeds/synchronizes the four built-in tenant roles. Existing custom roles are
 * never touched. System role permissions are code-controlled so security fixes
 * can be rolled out consistently across tenants.
 */
export async function ensureSystemRoles(companyId: string) {
  const roleDefinitions = [
    { code: SYSTEM_ROLE_CODES.OWNER, name: "Company Owner", legacyRole: "COMPANY_OWNER" },
    { code: SYSTEM_ROLE_CODES.HR_ADMIN, name: "HR Admin", legacyRole: "HR_ADMIN" },
    { code: SYSTEM_ROLE_CODES.BRANCH_MANAGER, name: "Branch Manager", legacyRole: "BRANCH_MANAGER" },
    { code: SYSTEM_ROLE_CODES.EMPLOYEE, name: "Employee", legacyRole: "EMPLOYEE" },
  ] as const;

  return db.$transaction(async (tx) => {
    const result: Array<{ id: string; code: string }> = [];

    for (const definition of roleDefinitions) {
      const role = await tx.tenantRole.upsert({
        where: { companyId_code: { companyId, code: definition.code } },
        update: {
          name: definition.name,
          description: `Built-in B-Attend role for ${definition.legacyRole}`,
          isSystem: true,
          isEditable: false,
          deletedAt: null,
        },
        create: {
          companyId,
          code: definition.code,
          name: definition.name,
          description: `Built-in B-Attend role for ${definition.legacyRole}`,
          isSystem: true,
          isEditable: false,
        },
      });

      await tx.tenantRolePermission.deleteMany({ where: { companyId, roleId: role.id } });
      await tx.tenantRolePermission.createMany({
        data: SYSTEM_ROLE_PERMISSIONS[definition.code].map((permissionKey) => ({
          companyId,
          roleId: role.id,
          permissionKey,
        })),
        skipDuplicates: true,
      });
      result.push({ id: role.id, code: role.code });
    }

    return result;
  });
}

export async function ensureLegacyUserAssignment(input: {
  companyId: string;
  userId: string;
  legacyRole: string;
  branchId?: string | null;
}) {
  const roles = await ensureSystemRoles(input.companyId);
  const roleCode = input.legacyRole === "COMPANY_OWNER"
    ? SYSTEM_ROLE_CODES.OWNER
    : input.legacyRole === "HR_ADMIN"
      ? SYSTEM_ROLE_CODES.HR_ADMIN
      : input.legacyRole === "BRANCH_MANAGER"
        ? SYSTEM_ROLE_CODES.BRANCH_MANAGER
        : SYSTEM_ROLE_CODES.EMPLOYEE;
  const role = roles.find((item) => item.code === roleCode);
  if (!role) throw new Error("SYSTEM_ROLE_NOT_FOUND");

  const scopeType: AccessScopeType = roleCode === SYSTEM_ROLE_CODES.OWNER || roleCode === SYSTEM_ROLE_CODES.HR_ADMIN
    ? "TENANT"
    : roleCode === SYSTEM_ROLE_CODES.BRANCH_MANAGER && input.branchId
      ? "BRANCH"
      : "SELF";
  const scopeId = scopeType === "BRANCH" ? input.branchId ?? null : null;
  const scopeKey = scopeId ?? "*";

  return db.userRoleAssignment.upsert({
    where: {
      userId_roleId_scopeType_scopeKey: {
        userId: input.userId,
        roleId: role.id,
        scopeType,
        scopeKey,
      },
    },
    update: { revokedAt: null, expiresAt: null, scopeId },
    create: {
      companyId: input.companyId,
      userId: input.userId,
      roleId: role.id,
      scopeType,
      scopeId,
      scopeKey,
    },
  });
}

async function loadAssignments(companyId: string, userId: string) {
  const now = new Date();
  const assignments = await db.userRoleAssignment.findMany({
    where: {
      companyId,
      userId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: {
      role: {
        include: { permissions: true },
      },
    },
  });
  return assignments.filter((assignment) => assignmentIsActive(assignment, now));
}

export async function evaluatePermission(input: {
  companyId: string;
  userId: string;
  legacyRole: string;
  permission: PermissionKey;
  scope?: AuthorizationScope;
}): Promise<AuthorizationDecision> {
  if (input.legacyRole === "COMPANY_OWNER") {
    return { allowed: true, permission: input.permission, source: "owner", matchedRoleCode: SYSTEM_ROLE_CODES.OWNER, matchedScopeType: "TENANT" };
  }

  const assignments = await loadAssignments(input.companyId, input.userId);
  if (assignments.length === 0) {
    const allowed = permissionsForLegacyRole(input.legacyRole).includes(input.permission);
    return {
      allowed,
      permission: input.permission,
      source: allowed ? "legacy" : "none",
      reason: allowed ? "Legacy role fallback while IAM assignments are not provisioned" : "Permission not granted",
    };
  }

  for (const assignment of assignments) {
    if (assignment.role.deletedAt || !assignment.role.permissions.some((item) => item.permissionKey === input.permission)) continue;
    if (!scopeMatches(assignment.scopeType as AccessScopeType, assignment.scopeId, input.userId, input.scope)) continue;
    return {
      allowed: true,
      permission: input.permission,
      source: "assignment",
      matchedRoleCode: assignment.role.code,
      matchedScopeType: assignment.scopeType as AccessScopeType,
      matchedScopeId: assignment.scopeId,
    };
  }

  return { allowed: false, permission: input.permission, source: "none", reason: "No active role assignment grants this permission in the requested scope" };
}

export async function hasPermission(
  permission: PermissionKey,
  scope: AuthorizationScope = {},
): Promise<boolean> {
  const session = await getSession();
  if (!session || session.kind !== "tenant" || !session.tenantId) return false;
  const decision = await evaluatePermission({
    companyId: session.tenantId,
    userId: session.sub,
    legacyRole: session.role,
    permission,
    scope,
  });
  return decision.allowed;
}

export async function requirePermission(
  permission: PermissionKey,
  scope: AuthorizationScope = {},
) {
  const session = await getSession();
  if (!session || session.kind !== "tenant" || !session.tenantId) throw new Error("UNAUTHENTICATED");
  const decision = await evaluatePermission({
    companyId: session.tenantId,
    userId: session.sub,
    legacyRole: session.role,
    permission,
    scope,
  });
  if (!decision.allowed) throw new Error(`PERMISSION_DENIED:${permission}`);
  return { session, decision };
}

/**
 * Authorization and subscription entitlements are deliberately separate.
 * This helper enforces both when a capability is sold as a plan feature.
 */
export async function requirePermissionAndEntitlement(
  permission: PermissionKey,
  featureKey: string,
  scope: AuthorizationScope = {},
) {
  const authorized = await requirePermission(permission, scope);
  const entitled = await canUseFeature(authorized.session.tenantId!, featureKey);
  if (!entitled) throw new Error(`ENTITLEMENT_REQUIRED:${featureKey}`);
  return authorized;
}

export async function getEffectivePermissions(input: {
  companyId: string;
  userId: string;
  legacyRole: string;
}): Promise<PermissionKey[]> {
  if (input.legacyRole === "COMPANY_OWNER") return [...PERMISSIONS];
  const assignments = await loadAssignments(input.companyId, input.userId);
  if (assignments.length === 0) return [...permissionsForLegacyRole(input.legacyRole)];
  const keys = new Set<PermissionKey>();
  for (const assignment of assignments) {
    for (const permission of assignment.role.permissions) {
      if ((PERMISSIONS as readonly string[]).includes(permission.permissionKey)) keys.add(permission.permissionKey as PermissionKey);
    }
  }
  return [...keys];
}
