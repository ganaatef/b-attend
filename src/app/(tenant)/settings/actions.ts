"use server";

/**
 * B-Attend tenant-side Server Actions — customer settings, support utilities,
 * attendance maintenance, and a compatibility shim for legacy user creation.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logTenantEvent } from "@/lib/auth/audit";
import { markAbsentForPastScheduledDays } from "@/lib/attendance/engine";
import { ensureSystemRoles, evaluatePermission } from "@/lib/auth/authorization";
import type { PermissionKey } from "@/lib/auth/permission-catalog";
import {
  AttendanceVerificationProviderConfigurationError,
  getAttendanceVerificationProvider,
  missingAttendanceVerificationCapabilities,
  type AttendanceVerificationCapability,
} from "@/lib/attendance/verification-provider";
import { inviteUserAction } from "../access/actions";

async function requireTenant() {
  const s = await getSession();
  if (!s || s.kind !== "tenant" || !s.tenantId) throw new Error("FORBIDDEN");
  return { ...s, tenantId: s.tenantId };
}

async function requireTenantPermission(permission: PermissionKey) {
  const s = await requireTenant();
  const decision = await evaluatePermission({
    companyId: s.tenantId,
    userId: s.sub,
    legacyRole: s.role,
    permission,
  });
  if (!decision.allowed) throw new Error(`PERMISSION_DENIED:${permission}`);
  return s;
}

const SettingsSchema = z.object({
  industry: z.string().optional(),
  timezone: z.string().default("Africa/Cairo"),
  currency: z.string().default("EGP"),
  defaultLanguage: z.string().default("en"),
  defaultGeofenceRadius: z.coerce.number().int().min(50).max(2000),
  defaultGraceMinutes: z.coerce.number().int().min(0).max(120),
  defaultOvertimeThresholdMinutes: z.coerce.number().int().min(0).max(1440),
  enableMobileClock: z.enum(["true", "false"]).or(z.boolean()),
  enableKioskClock: z.enum(["true", "false"]).or(z.boolean()),
  requireApprovalOutsideGeofence: z.enum(["true", "false"]).or(z.boolean()),
  requireApprovalOvertime: z.enum(["true", "false"]).or(z.boolean()),
  allowNoScheduleClockIn: z.enum(["true", "false"]).or(z.boolean()),
  allowManualRequests: z.enum(["true", "false"]).or(z.boolean()),
  enableEmployeeSelfService: z.enum(["true", "false"]).or(z.boolean()),
  enableBranchManagerApprovals: z.enum(["true", "false"]).or(z.boolean()),
  emailNotifications: z.enum(["true", "false"]).or(z.boolean()),
  whatsappNotifications: z.enum(["true", "false"]).or(z.boolean()),
  trustReviewBelow: z.coerce.number().int().min(1).max(100),
  trustRejectBelow: z.coerce.number().int().min(0).max(99),
  trustBlockCriticalRisk: z.enum(["true", "false"]).or(z.boolean()),
  trustRequireDeviceIntegrity: z.enum(["true", "false"]).or(z.boolean()),
  trustRequireFace: z.enum(["true", "false"]).or(z.boolean()),
  trustRequireLiveness: z.enum(["true", "false"]).or(z.boolean()),
  biometricRetentionHours: z.coerce.number().int().min(1).max(168),
});

export async function updateCustomerSettingsAction(prev: any, formData: FormData) {
  try {
    const s = await requireTenantPermission("company.settings.manage");
    const parsed = SettingsSchema.safeParse({
      industry: formData.get("industry") || undefined,
      timezone: formData.get("timezone"),
      currency: formData.get("currency"),
      defaultLanguage: formData.get("defaultLanguage"),
      defaultGeofenceRadius: formData.get("defaultGeofenceRadius"),
      defaultGraceMinutes: formData.get("defaultGraceMinutes"),
      defaultOvertimeThresholdMinutes: formData.get("defaultOvertimeThresholdMinutes"),
      enableMobileClock: formData.get("enableMobileClock") ?? "true",
      enableKioskClock: formData.get("enableKioskClock") ?? "true",
      requireApprovalOutsideGeofence: formData.get("requireApprovalOutsideGeofence") ?? "true",
      requireApprovalOvertime: formData.get("requireApprovalOvertime") ?? "true",
      allowNoScheduleClockIn: formData.get("allowNoScheduleClockIn") ?? "false",
      allowManualRequests: formData.get("allowManualRequests") ?? "true",
      enableEmployeeSelfService: formData.get("enableEmployeeSelfService") ?? "true",
      enableBranchManagerApprovals: formData.get("enableBranchManagerApprovals") ?? "true",
      emailNotifications: formData.get("emailNotifications") ?? "true",
      whatsappNotifications: formData.get("whatsappNotifications") ?? "false",
      trustReviewBelow: formData.get("trustReviewBelow") ?? "75",
      trustRejectBelow: formData.get("trustRejectBelow") ?? "30",
      trustBlockCriticalRisk: formData.get("trustBlockCriticalRisk") ?? "false",
      trustRequireDeviceIntegrity: formData.get("trustRequireDeviceIntegrity") ?? "false",
      trustRequireFace: formData.get("trustRequireFace") ?? "false",
      trustRequireLiveness: formData.get("trustRequireLiveness") ?? "false",
      biometricRetentionHours: formData.get("biometricRetentionHours") ?? "24",
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    if (parsed.data.trustRejectBelow >= parsed.data.trustReviewBelow) {
      return { ok: false, error: "Trust reject threshold must be lower than the review threshold" };
    }

    const d: any = parsed.data;
    for (const k of [
      "enableMobileClock",
      "enableKioskClock",
      "requireApprovalOutsideGeofence",
      "requireApprovalOvertime",
      "allowNoScheduleClockIn",
      "allowManualRequests",
      "enableEmployeeSelfService",
      "enableBranchManagerApprovals",
      "emailNotifications",
      "whatsappNotifications",
      "trustBlockCriticalRisk",
      "trustRequireDeviceIntegrity",
      "trustRequireFace",
      "trustRequireLiveness",
    ]) {
      d[k] = d[k] === true || d[k] === "true";
    }

    const requiredCapabilities: AttendanceVerificationCapability[] = [];
    if (d.trustRequireDeviceIntegrity) requiredCapabilities.push("DEVICE_INTEGRITY");
    if (d.trustRequireFace) requiredCapabilities.push("FACE_MATCH");
    if (d.trustRequireLiveness) requiredCapabilities.push("LIVENESS");

    if (requiredCapabilities.length > 0) {
      let provider;
      try {
        provider = getAttendanceVerificationProvider();
      } catch (error) {
        if (error instanceof AttendanceVerificationProviderConfigurationError) {
          return { ok: false, error: "Attendance verification provider is misconfigured." };
        }
        throw error;
      }
      const missing = missingAttendanceVerificationCapabilities(provider, requiredCapabilities);
      if (missing.length > 0) {
        return {
          ok: false,
          error: `Connect a verification provider before requiring: ${missing.join(", ")}`,
        };
      }
    }

    await db.companySettings.upsert({
      where: { companyId: s.tenantId },
      update: d,
      create: { companyId: s.tenantId, ...d },
    });
    await logTenantEvent({ companyId: s.tenantId, actorId: s.sub, actorEmail: s.email, action: "SETTINGS_UPDATED", entityType: "CompanySettings" });
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    console.error("[actions] updateCustomerSettingsAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

const TicketSchema = z.object({
  subject: z.string().min(3),
  category: z.string().optional(),
  message: z.string().min(10),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
});

export async function createTicketAction(prev: any, formData: FormData) {
  try {
    const s = await requireTenantPermission("support.use");
    const parsed = TicketSchema.safeParse({
      subject: formData.get("subject"),
      category: formData.get("category") || undefined,
      message: formData.get("message"),
      priority: formData.get("priority") ?? "NORMAL",
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const d = parsed.data;
    const ticket = await db.supportTicket.create({
      data: {
        companyId: s.tenantId,
        subject: d.subject,
        category: d.category,
        message: d.message,
        priority: d.priority,
        status: "OPEN",
        createdByEmail: s.email,
        createdById: s.sub,
      },
    });
    await db.supportMessage.create({
      data: { ticketId: ticket.id, authorId: s.sub, authorEmail: s.email, authorRole: s.role, body: d.message, isInternal: false },
    });
    revalidatePath("/support");
    return { ok: true };
  } catch (e) {
    console.error("[actions] createTicketAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

const TicketReplySchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().min(1),
});

export async function replyToTicketAction(prev: any, formData: FormData) {
  try {
    const s = await requireTenantPermission("support.use");
    const parsed = TicketReplySchema.safeParse({
      ticketId: formData.get("ticketId"),
      body: formData.get("body"),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const ticket = await db.supportTicket.findFirst({ where: { id: parsed.data.ticketId, companyId: s.tenantId } });
    if (!ticket) return { ok: false, error: "Ticket not found" };
    await db.supportMessage.create({
      data: { ticketId: ticket.id, authorId: s.sub, authorEmail: s.email, authorRole: s.role, body: parsed.data.body, isInternal: false },
    });
    await db.supportTicket.update({ where: { id: ticket.id }, data: { status: "WAITING_CUSTOMER" } });
    revalidatePath(`/support/${ticket.id}`);
    revalidatePath("/support");
    return { ok: true };
  } catch (e) {
    console.error("[actions] replyToTicketAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function runMarkAbsentAction(daysBack: number) {
  try {
    const s = await requireTenantPermission("attendance.manage");
    const r = await markAbsentForPastScheduledDays({ companyId: s.tenantId, daysBack });
    await logTenantEvent({ companyId: s.tenantId, actorId: s.sub, actorEmail: s.email, action: "ATTENDANCE_RECALCULATED", reason: `Manual mark-absent daysBack=${daysBack} marked=${r.marked}` });
    revalidatePath("/reports");
    revalidatePath("/dashboard");
    return r;
  } catch (e) {
    console.error("[actions] runMarkAbsentAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

// ─────────────────────────────────────────────
// Legacy user-management compatibility
// ─────────────────────────────────────────────
// No temporary password is ever generated. Old callers are routed into the
// secure invitation flow until /users has fully moved to /access.

const CreateUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["HR_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"]),
  branchId: z.string().optional(),
});

export async function createUserAction(prev: any, formData: FormData) {
  try {
    const s = await requireTenantPermission("users.invite");
    const parsed = CreateUserSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      role: formData.get("role"),
      branchId: formData.get("branchId") || undefined,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const d = parsed.data;
    if (d.role === "BRANCH_MANAGER" && !d.branchId) return { ok: false, error: "Branch managers require a branch scope." };

    await ensureSystemRoles(s.tenantId);
    const roleCode = d.role === "HR_ADMIN" ? "HR_ADMIN" : d.role === "BRANCH_MANAGER" ? "BRANCH_MANAGER" : "EMPLOYEE";
    const role = await db.tenantRole.findUnique({
      where: { companyId_code: { companyId: s.tenantId, code: roleCode } },
      select: { id: true },
    });
    if (!role) return { ok: false, error: "Access role is unavailable." };

    const inviteData = new FormData();
    inviteData.set("name", d.name);
    inviteData.set("email", d.email);
    inviteData.set("roleId", role.id);
    inviteData.set("scopeType", d.role === "HR_ADMIN" ? "TENANT" : d.role === "BRANCH_MANAGER" ? "BRANCH" : "SELF");
    if (d.branchId) inviteData.set("scopeId", d.branchId);

    const result = await inviteUserAction(prev, inviteData);
    revalidatePath("/users");
    revalidatePath("/access");
    return result;
  } catch (e) {
    console.error("[actions] createUserAction compatibility flow failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}
