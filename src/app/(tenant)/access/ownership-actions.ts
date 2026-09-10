"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureSystemRoles, requirePermission } from "@/lib/auth/authorization";
import { verifyPassword } from "@/lib/auth/password";
import { destroySession } from "@/lib/auth/session";
import { logTenantEvent } from "@/lib/auth/audit";
import { checkRateLimit } from "@/lib/rate-limit";

export type OwnershipTransferState = {
  ok: boolean;
  error?: string;
  signedOut?: boolean;
};

const TransferSchema = z.object({
  targetUserId: z.string().trim().min(1),
  newOwnerPhone: z.string().trim().min(6).max(30),
  currentPassword: z.string().min(1),
  confirmation: z.literal("TRANSFER"),
});

export async function transferOwnershipAction(
  prev: OwnershipTransferState,
  formData: FormData,
): Promise<OwnershipTransferState> {
  try {
    const { session } = await requirePermission("users.roles.manage");
    const companyId = session.tenantId!;

    // Ownership itself is intentionally non-delegable. A custom role with
    // users.roles.manage may administer roles but can never become an owner-transfer surrogate.
    if (session.role !== "COMPANY_OWNER") {
      return { ok: false, error: "Only the current primary owner can transfer ownership." };
    }

    const limit = await checkRateLimit(session.sub, "/access/ownership-transfer", 5, 15 * 60_000);
    if (!limit.allowed) {
      return { ok: false, error: "Too many ownership-transfer attempts. Try again later." };
    }

    const parsed = TransferSchema.safeParse({
      targetUserId: formData.get("targetUserId"),
      newOwnerPhone: formData.get("newOwnerPhone"),
      currentPassword: formData.get("currentPassword"),
      confirmation: formData.get("confirmation"),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "Invalid ownership-transfer request." };
    }

    if (parsed.data.targetUserId === session.sub) {
      return { ok: false, error: "Select another active user as the new owner." };
    }

    const ownerUsers = await db.user.findMany({
      where: { companyId, role: "COMPANY_OWNER", status: "ACTIVE", deletedAt: null },
      select: { id: true, email: true, name: true, passwordHash: true },
    });
    if (ownerUsers.length !== 1 || ownerUsers[0]?.id !== session.sub) {
      return { ok: false, error: "Ownership state is inconsistent. Contact platform support before transferring ownership." };
    }

    const currentOwner = ownerUsers[0];
    const passwordOk = await verifyPassword(parsed.data.currentPassword, currentOwner.passwordHash);
    if (!passwordOk) return { ok: false, error: "Current password is incorrect." };

    const target = await db.user.findFirst({
      where: { id: parsed.data.targetUserId, companyId, status: "ACTIVE", deletedAt: null },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!target) return { ok: false, error: "The selected new owner is not an active user in this company." };

    const roles = await ensureSystemRoles(companyId);
    const ownerRole = roles.find((role) => role.code === "OWNER");
    const hrRole = roles.find((role) => role.code === "HR_ADMIN");
    if (!ownerRole || !hrRole) throw new Error("SYSTEM_OWNER_ROLES_NOT_FOUND");

    await db.$transaction(async (tx) => {
      // Reject silent data inconsistencies instead of guessing which owner is canonical.
      const activeOwnerCount = await tx.user.count({
        where: { companyId, role: "COMPANY_OWNER", status: "ACTIVE", deletedAt: null },
      });
      if (activeOwnerCount !== 1) throw new Error("OWNER_INVARIANT_VIOLATION");

      // Revoke the old OWNER assignment before granting the new one. User-role
      // changes happen in the same transaction, so there is no split-brain owner state.
      await tx.userRoleAssignment.updateMany({
        where: { companyId, roleId: ownerRole.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tx.user.update({
        where: { id: currentOwner.id },
        data: { role: "HR_ADMIN" },
      });
      await tx.user.update({
        where: { id: target.id },
        data: { role: "COMPANY_OWNER" },
      });

      await tx.userRoleAssignment.upsert({
        where: {
          userId_roleId_scopeType_scopeKey: {
            userId: target.id,
            roleId: ownerRole.id,
            scopeType: "TENANT",
            scopeKey: "*",
          },
        },
        update: { revokedAt: null, expiresAt: null, scopeId: null, grantedByUserId: currentOwner.id },
        create: {
          companyId,
          userId: target.id,
          roleId: ownerRole.id,
          scopeType: "TENANT",
          scopeId: null,
          scopeKey: "*",
          grantedByUserId: currentOwner.id,
        },
      });

      // The outgoing owner remains an HR administrator instead of being
      // unexpectedly locked out of the company after the transfer.
      await tx.userRoleAssignment.upsert({
        where: {
          userId_roleId_scopeType_scopeKey: {
            userId: currentOwner.id,
            roleId: hrRole.id,
            scopeType: "TENANT",
            scopeKey: "*",
          },
        },
        update: { revokedAt: null, expiresAt: null, scopeId: null, grantedByUserId: currentOwner.id },
        create: {
          companyId,
          userId: currentOwner.id,
          roleId: hrRole.id,
          scopeType: "TENANT",
          scopeId: null,
          scopeKey: "*",
          grantedByUserId: currentOwner.id,
        },
      });

      await tx.tenant.update({
        where: { id: companyId },
        data: {
          ownerName: target.name,
          ownerEmail: target.email,
          ownerPhone: parsed.data.newOwnerPhone,
        },
      });
    });

    await logTenantEvent({
      companyId,
      actorId: currentOwner.id,
      actorEmail: currentOwner.email,
      action: "OWNERSHIP_TRANSFERRED",
      entityType: "Tenant",
      entityId: companyId,
      beforeData: { ownerUserId: currentOwner.id, ownerEmail: currentOwner.email },
      afterData: { ownerUserId: target.id, ownerEmail: target.email },
      reason: "Primary ownership transfer with password re-authentication",
    });

    // Destroy the outgoing owner's cookie. The next login obtains their new
    // HR_ADMIN role; stale privilege cannot survive this security-sensitive change.
    await destroySession();
    revalidatePath("/access");
    return { ok: true, signedOut: true };
  } catch (error) {
    console.error("[access] transferOwnershipAction failed", error);
    return { ok: false, error: "Could not transfer ownership. No ownership change was completed." };
  }
}
