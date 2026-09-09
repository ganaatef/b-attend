"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { logTenantEvent } from "@/lib/auth/audit";
import { ensureSystemRoles, requirePermission, type AccessScopeType } from "@/lib/auth/authorization";
import { isPermissionKey } from "@/lib/auth/permission-catalog";
import { buildInvitationUrl, generateInvitationToken } from "@/lib/auth/invitation-token";
import { sendTransactionalEmail } from "@/lib/email/transactional";

const ScopeTypeSchema = z.enum(["TENANT", "BRANCH", "DEPARTMENT", "SELF"]);

async function validateScope(companyId: string, scopeType: AccessScopeType, scopeId?: string | null) {
  if (scopeType === "TENANT" || scopeType === "SELF") return { ok: true as const, scopeId: null, scopeKey: "*" };
  if (!scopeId) return { ok: false as const, error: "A scope is required for this role assignment." };

  if (scopeType === "BRANCH") {
    const branch = await db.branch.findFirst({ where: { id: scopeId, companyId, deletedAt: null }, select: { id: true } });
    if (!branch) return { ok: false as const, error: "Branch not found." };
  } else {
    const department = await db.department.findFirst({ where: { id: scopeId, companyId }, select: { id: true } });
    if (!department) return { ok: false as const, error: "Department not found." };
  }
  return { ok: true as const, scopeId, scopeKey: scopeId };
}

function normalizeRoleCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export async function syncSystemRolesAction() {
  const { session } = await requirePermission("users.roles.manage");
  await ensureSystemRoles(session.tenantId!);
  await logTenantEvent({
    companyId: session.tenantId!,
    actorId: session.sub,
    actorEmail: session.email,
    action: "SYSTEM_ROLES_SYNCED",
    entityType: "TenantRole",
  });
  revalidatePath("/access");
  return { ok: true };
}

const CreateRoleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().min(2).max(48),
  description: z.string().trim().max(300).optional(),
  permissions: z.string().default(""),
});

export async function createCustomRoleAction(prev: unknown, formData: FormData) {
  try {
    const { session } = await requirePermission("users.roles.manage");
    const parsed = CreateRoleSchema.safeParse({
      name: formData.get("name"),
      code: formData.get("code"),
      description: formData.get("description") || undefined,
      permissions: formData.get("permissions") || "",
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid role" };

    const code = normalizeRoleCode(parsed.data.code);
    if (!code) return { ok: false, error: "Role code is invalid." };
    if (["OWNER", "HR_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"].includes(code)) {
      return { ok: false, error: "This role code is reserved by the system." };
    }

    const permissions = [...new Set(parsed.data.permissions.split(",").map((value) => value.trim()).filter(isPermissionKey))];
    if (permissions.length === 0) return { ok: false, error: "Select at least one permission." };

    const role = await db.$transaction(async (tx) => {
      const created = await tx.tenantRole.create({
        data: {
          companyId: session.tenantId!,
          name: parsed.data.name,
          code,
          description: parsed.data.description || null,
          isSystem: false,
          isEditable: true,
        },
      });
      await tx.tenantRolePermission.createMany({
        data: permissions.map((permissionKey) => ({ companyId: session.tenantId!, roleId: created.id, permissionKey })),
      });
      return created;
    });

    await logTenantEvent({
      companyId: session.tenantId!,
      actorId: session.sub,
      actorEmail: session.email,
      action: "CUSTOM_ROLE_CREATED",
      entityType: "TenantRole",
      entityId: role.id,
      afterData: { code, permissions },
    });
    revalidatePath("/access");
    return { ok: true };
  } catch (error) {
    if (String(error).includes("Unique constraint")) return { ok: false, error: "Role code already exists." };
    console.error("[access] createCustomRoleAction failed", error);
    return { ok: false, error: "Could not create the role." };
  }
}

export async function updateRolePermissionsAction(roleId: string, permissionKeys: string[]) {
  const { session } = await requirePermission("users.roles.manage");
  const role = await db.tenantRole.findFirst({
    where: { id: roleId, companyId: session.tenantId!, deletedAt: null },
    select: { id: true, code: true, isSystem: true, isEditable: true },
  });
  if (!role) return { ok: false, error: "Role not found." };
  if (role.isSystem || !role.isEditable) return { ok: false, error: "Built-in roles are code-controlled and cannot be edited." };

  const permissions = [...new Set(permissionKeys.filter(isPermissionKey))];
  if (permissions.length === 0) return { ok: false, error: "A role must have at least one permission." };

  await db.$transaction(async (tx) => {
    await tx.tenantRolePermission.deleteMany({ where: { companyId: session.tenantId!, roleId } });
    await tx.tenantRolePermission.createMany({
      data: permissions.map((permissionKey) => ({ companyId: session.tenantId!, roleId, permissionKey })),
    });
  });
  await logTenantEvent({
    companyId: session.tenantId!,
    actorId: session.sub,
    actorEmail: session.email,
    action: "ROLE_PERMISSIONS_UPDATED",
    entityType: "TenantRole",
    entityId: roleId,
    afterData: { permissions },
  });
  revalidatePath("/access");
  return { ok: true };
}

const InviteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  employeeId: z.string().trim().optional(),
  roleId: z.string().trim().min(1),
  scopeType: ScopeTypeSchema.default("TENANT"),
  scopeId: z.string().trim().optional(),
});

export async function inviteUserAction(prev: unknown, formData: FormData) {
  try {
    const { session } = await requirePermission("users.invite");
    await ensureSystemRoles(session.tenantId!);
    const parsed = InviteSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      employeeId: formData.get("employeeId") || undefined,
      roleId: formData.get("roleId"),
      scopeType: formData.get("scopeType") || "TENANT",
      scopeId: formData.get("scopeId") || undefined,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid invitation" };
    const input = parsed.data;

    const role = await db.tenantRole.findFirst({
      where: { id: input.roleId, companyId: session.tenantId!, deletedAt: null },
      select: { id: true, code: true, name: true },
    });
    if (!role) return { ok: false, error: "Role not found." };
    if (role.code === "OWNER") return { ok: false, error: "Use the ownership-transfer flow to change the primary owner." };

    const existingUser = await db.user.findFirst({
      where: { companyId: session.tenantId!, email: input.email, deletedAt: null },
      select: { id: true },
    });
    if (existingUser) return { ok: false, error: "A user with this email already exists in this company." };

    if (input.employeeId) {
      const employee = await db.employee.findFirst({
        where: { id: input.employeeId, companyId: session.tenantId!, deletedAt: null },
        select: { id: true, user: { select: { id: true } } },
      });
      if (!employee) return { ok: false, error: "Employee not found." };
      if (employee.user) return { ok: false, error: "This employee already has an app account." };
    }

    const scope = await validateScope(session.tenantId!, input.scopeType, input.scopeId);
    if (!scope.ok) return { ok: false, error: scope.error };

    const { token, tokenHash, expiresAt } = generateInvitationToken();
    const invitation = await db.$transaction(async (tx) => {
      await tx.userInvitation.updateMany({
        where: { companyId: session.tenantId!, email: input.email, status: "PENDING" },
        data: { status: "REVOKED", revokedAt: new Date() },
      });
      const created = await tx.userInvitation.create({
        data: {
          companyId: session.tenantId!,
          email: input.email,
          name: input.name,
          employeeId: input.employeeId || null,
          tokenHash,
          status: "PENDING",
          expiresAt,
          invitedByUserId: session.sub,
        },
      });
      await tx.userInvitationRole.create({
        data: {
          companyId: session.tenantId!,
          invitationId: created.id,
          roleId: role.id,
          scopeType: input.scopeType,
          scopeId: scope.scopeId,
          scopeKey: scope.scopeKey,
        },
      });
      return created;
    });

    const invitationUrl = buildInvitationUrl(token);
    const delivery = await sendTransactionalEmail({
      to: input.email,
      subject: "You are invited to B-Attend",
      text: `Hello ${input.name},\n\nYou were invited to join your company on B-Attend as ${role.name}.\nSet your password using this secure link (expires in 72 hours):\n${invitationUrl}\n\nIf you did not expect this invitation, ignore this message.`,
      html: `<p>Hello ${input.name},</p><p>You were invited to join your company on <strong>B-Attend</strong> as <strong>${role.name}</strong>.</p><p><a href="${invitationUrl}">Accept invitation and set your password</a></p><p>This link expires in 72 hours.</p>`,
    });

    await logTenantEvent({
      companyId: session.tenantId!,
      actorId: session.sub,
      actorEmail: session.email,
      action: "USER_INVITED",
      entityType: "UserInvitation",
      entityId: invitation.id,
      afterData: { email: input.email, roleCode: role.code, scopeType: input.scopeType, scopeId: scope.scopeId, emailSent: delivery.sent },
    });
    revalidatePath("/access");
    return { ok: true, emailSent: delivery.sent, invitationUrl: delivery.sent ? undefined : invitationUrl };
  } catch (error) {
    console.error("[access] inviteUserAction failed", error);
    return { ok: false, error: "Could not create the invitation." };
  }
}

export async function revokeInvitationAction(invitationId: string) {
  const { session } = await requirePermission("users.manage");
  const result = await db.userInvitation.updateMany({
    where: { id: invitationId, companyId: session.tenantId!, status: "PENDING" },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  if (result.count === 0) return { ok: false, error: "Invitation not found or already closed." };
  await logTenantEvent({
    companyId: session.tenantId!,
    actorId: session.sub,
    actorEmail: session.email,
    action: "USER_INVITATION_REVOKED",
    entityType: "UserInvitation",
    entityId: invitationId,
  });
  revalidatePath("/access");
  return { ok: true };
}

export async function suspendUserAction(userId: string) {
  const { session } = await requirePermission("users.manage");
  if (userId === session.sub) return { ok: false, error: "You cannot suspend your own account." };
  const user = await db.user.findFirst({ where: { id: userId, companyId: session.tenantId!, deletedAt: null } });
  if (!user) return { ok: false, error: "User not found." };
  if (user.role === "COMPANY_OWNER") return { ok: false, error: "The primary owner cannot be suspended. Transfer ownership first." };

  await db.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });
  await logTenantEvent({
    companyId: session.tenantId!,
    actorId: session.sub,
    actorEmail: session.email,
    action: "USER_SUSPENDED",
    entityType: "User",
    entityId: user.id,
  });
  revalidatePath("/access");
  return { ok: true };
}

export async function restoreUserAction(userId: string) {
  const { session } = await requirePermission("users.manage");
  const user = await db.user.findFirst({ where: { id: userId, companyId: session.tenantId!, deletedAt: null } });
  if (!user) return { ok: false, error: "User not found." };
  await db.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });
  await logTenantEvent({
    companyId: session.tenantId!,
    actorId: session.sub,
    actorEmail: session.email,
    action: "USER_RESTORED",
    entityType: "User",
    entityId: user.id,
  });
  revalidatePath("/access");
  return { ok: true };
}

export async function assignRoleAction(input: {
  userId: string;
  roleId: string;
  scopeType: AccessScopeType;
  scopeId?: string | null;
}) {
  const { session } = await requirePermission("users.roles.manage");
  const [user, role] = await Promise.all([
    db.user.findFirst({ where: { id: input.userId, companyId: session.tenantId!, deletedAt: null } }),
    db.tenantRole.findFirst({ where: { id: input.roleId, companyId: session.tenantId!, deletedAt: null } }),
  ]);
  if (!user || !role) return { ok: false, error: "User or role not found." };
  if (user.role === "COMPANY_OWNER" && role.code !== "OWNER") return { ok: false, error: "Primary owner access is protected." };

  const scope = await validateScope(session.tenantId!, input.scopeType, input.scopeId);
  if (!scope.ok) return { ok: false, error: scope.error };

  await db.userRoleAssignment.upsert({
    where: {
      userId_roleId_scopeType_scopeKey: {
        userId: user.id,
        roleId: role.id,
        scopeType: input.scopeType,
        scopeKey: scope.scopeKey,
      },
    },
    update: { revokedAt: null, expiresAt: null, scopeId: scope.scopeId, grantedByUserId: session.sub },
    create: {
      companyId: session.tenantId!,
      userId: user.id,
      roleId: role.id,
      scopeType: input.scopeType,
      scopeId: scope.scopeId,
      scopeKey: scope.scopeKey,
      grantedByUserId: session.sub,
    },
  });
  await logTenantEvent({
    companyId: session.tenantId!,
    actorId: session.sub,
    actorEmail: session.email,
    action: "ROLE_ASSIGNED",
    entityType: "User",
    entityId: user.id,
    afterData: { roleCode: role.code, scopeType: input.scopeType, scopeId: scope.scopeId },
  });
  revalidatePath("/access");
  return { ok: true };
}

export async function revokeRoleAssignmentAction(assignmentId: string) {
  const { session } = await requirePermission("users.roles.manage");
  const assignment = await db.userRoleAssignment.findFirst({
    where: { id: assignmentId, companyId: session.tenantId!, revokedAt: null },
    include: { user: true, role: true },
  });
  if (!assignment) return { ok: false, error: "Role assignment not found." };
  if (assignment.user.role === "COMPANY_OWNER" || assignment.role.code === "OWNER") {
    return { ok: false, error: "Primary owner access cannot be revoked here." };
  }
  await db.userRoleAssignment.update({ where: { id: assignment.id }, data: { revokedAt: new Date() } });
  await logTenantEvent({
    companyId: session.tenantId!,
    actorId: session.sub,
    actorEmail: session.email,
    action: "ROLE_REVOKED",
    entityType: "User",
    entityId: assignment.userId,
    afterData: { roleCode: assignment.role.code, assignmentId: assignment.id },
  });
  revalidatePath("/access");
  return { ok: true };
}
