"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { hashInvitationToken } from "@/lib/auth/invitation-token";
import { isTenantOperationalState } from "@/lib/auth/subscription-state";

const AcceptInviteSchema = z.object({
  token: z.string().min(20).max(256),
  password: z.string()
    .min(12, "Password must be at least 12 characters")
    .max(128, "Password is too long")
    .regex(/[A-Za-z\u0600-\u06FF]/, "Password must include at least one letter")
    .regex(/[0-9]/, "Password must include at least one number"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match",
});

export type AcceptInviteState =
  | { ok: false; error?: string }
  | { ok: true; message: string };

function deriveLegacyRole(roleCodes: string[]) {
  if (roleCodes.includes("OWNER")) return null;
  if (roleCodes.includes("HR_ADMIN")) return "HR_ADMIN" as const;
  if (roleCodes.includes("BRANCH_MANAGER")) return "BRANCH_MANAGER" as const;
  return "EMPLOYEE" as const;
}

export async function acceptInviteAction(
  prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const parsed = AcceptInviteSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid invitation" };

  const tokenHash = hashInvitationToken(parsed.data.token);
  const invitation = await db.userInvitation.findUnique({
    where: { tokenHash },
    include: {
      tenant: {
        include: {
          subscription: true,
        },
      },
      employee: true,
      roles: {
        include: { role: true },
      },
    },
  });

  if (!invitation || invitation.status !== "PENDING" || invitation.revokedAt) {
    return { ok: false, error: "This invitation is invalid or has already been used." };
  }
  if (invitation.expiresAt <= new Date()) {
    await db.userInvitation.updateMany({
      where: { id: invitation.id, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
    return { ok: false, error: "This invitation has expired. Ask your company administrator for a new invitation." };
  }
  if (!isTenantOperationalState(invitation.tenant)) {
    return { ok: false, error: "This company workspace is not currently active. Contact your company administrator." };
  }
  if (invitation.roles.length === 0) {
    return { ok: false, error: "This invitation has no access role. Ask your company administrator to resend it." };
  }

  const roleCodes = invitation.roles.map((item) => item.role.code);
  const legacyRole = deriveLegacyRole(roleCodes);
  if (!legacyRole) {
    return { ok: false, error: "Owner access must be transferred through the protected ownership flow." };
  }

  const [existingUser, existingEmployeeAccount] = await Promise.all([
    db.user.findFirst({
      where: { companyId: invitation.companyId, email: invitation.email.toLowerCase(), deletedAt: null },
      select: { id: true },
    }),
    invitation.employeeId
      ? db.user.findFirst({ where: { companyId: invitation.companyId, employeeId: invitation.employeeId, deletedAt: null }, select: { id: true } })
      : Promise.resolve(null),
  ]);
  if (existingUser) return { ok: false, error: "An account with this email already exists in this company." };
  if (existingEmployeeAccount) return { ok: false, error: "This employee already has an app account." };
  if (invitation.employee && (invitation.employee.deletedAt || invitation.employee.companyId !== invitation.companyId)) {
    return { ok: false, error: "The linked employee record is no longer available." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  try {
    await db.$transaction(async (tx) => {
      const freshInvite = await tx.userInvitation.findUnique({
        where: { id: invitation.id },
        include: { roles: true },
      });
      if (!freshInvite || freshInvite.status !== "PENDING" || freshInvite.revokedAt || freshInvite.expiresAt <= new Date()) {
        throw new Error("INVITATION_CLOSED");
      }

      const user = await tx.user.create({
        data: {
          companyId: invitation.companyId,
          email: invitation.email.toLowerCase(),
          passwordHash,
          name: invitation.name,
          role: legacyRole,
          status: "ACTIVE",
          forcePasswordChange: false,
          lastPasswordChangeAt: new Date(),
          employeeId: invitation.employeeId || null,
        },
      });

      await tx.userRoleAssignment.createMany({
        data: freshInvite.roles.map((assignment) => ({
          companyId: invitation.companyId,
          userId: user.id,
          roleId: assignment.roleId,
          scopeType: assignment.scopeType,
          scopeId: assignment.scopeId,
          scopeKey: assignment.scopeKey,
          grantedByUserId: invitation.invitedByUserId,
        })),
        skipDuplicates: true,
      });

      if (invitation.employeeId) {
        await tx.employee.update({
          where: { id: invitation.employeeId, companyId: invitation.companyId },
          data: { userId: user.id },
        });
      }

      await tx.userInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedByUserId: user.id,
          acceptedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: invitation.companyId,
          actorId: user.id,
          actorEmail: user.email,
          action: "USER_INVITATION_ACCEPTED",
          entityType: "User",
          entityId: user.id,
          afterData: JSON.stringify({
            roleCodes,
            employeeId: invitation.employeeId,
          }),
        },
      });
    });
  } catch (error) {
    if (String(error).includes("INVITATION_CLOSED")) {
      return { ok: false, error: "This invitation is no longer available." };
    }
    if (String(error).includes("Unique constraint")) {
      return { ok: false, error: "This account was already created. Sign in instead." };
    }
    console.error("[invite] acceptInviteAction failed", error);
    return { ok: false, error: "Could not activate the account. Please try again." };
  }

  return { ok: true, message: "Your B-Attend account is ready. You can sign in now." };
}
