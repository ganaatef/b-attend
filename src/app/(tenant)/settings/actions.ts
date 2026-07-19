"use server";

/**
 * B-Attend tenant-side Server Actions — Phase 7.
 * Customer settings + support tickets + mark-absent trigger.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logTenantEvent } from "@/lib/auth/audit";
import { markAbsentForPastScheduledDays } from "@/lib/attendance/engine";

async function requireTenant() {
  const s = await getSession();
  if (!s || s.kind !== "tenant" || !s.tenantId) throw new Error("FORBIDDEN");
  return s;
}

async function requireTenantAdmin() {
  const s = await requireTenant();
  if (s.role !== "COMPANY_OWNER" && s.role !== "HR_ADMIN") throw new Error("FORBIDDEN");
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
});

export async function updateCustomerSettingsAction(prev: any, formData: FormData) {
  try {
    const s = await requireTenantAdmin();
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
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const d: any = parsed.data;
    for (const k of ["enableMobileClock", "enableKioskClock", "requireApprovalOutsideGeofence", "requireApprovalOvertime", "allowNoScheduleClockIn", "allowManualRequests", "enableEmployeeSelfService", "enableBranchManagerApprovals", "emailNotifications", "whatsappNotifications"]) {
      d[k] = d[k] === true || d[k] === "true";
    }
    await db.companySettings.upsert({
      where: { companyId: s.tenantId! },
      update: d,
      create: { companyId: s.tenantId!, ...d },
    });
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "SETTINGS_UPDATED", entityType: "CompanySettings" });
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
    const s = await requireTenant();
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
        companyId: s.tenantId!,
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
    const s = await requireTenant();
    const parsed = TicketReplySchema.safeParse({
      ticketId: formData.get("ticketId"),
      body: formData.get("body"),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const ticket = await db.supportTicket.findFirst({ where: { id: parsed.data.ticketId, companyId: s.tenantId! } });
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
    const s = await requireTenantAdmin();
    const r = await markAbsentForPastScheduledDays({ companyId: s.tenantId!, daysBack });
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "ATTENDANCE_RECALCULATED", reason: `Manual mark-absent daysBack=${daysBack} marked=${r.marked}` });
    revalidatePath("/reports");
    revalidatePath("/dashboard");
    return r;
  } catch (e) {
    console.error("[actions] runMarkAbsentAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

// ─────────────────────────────────────────────
// User management (owner/HR)
// ─────────────────────────────────────────────

const CreateUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["HR_ADMIN", "BRANCH_MANAGER", "EMPLOYEE"]),
  branchId: z.string().optional(),
});

export async function createUserAction(prev: any, formData: FormData) {
  try {
    const s = await requireTenantAdmin();
    const parsed = CreateUserSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      role: formData.get("role"),
      branchId: formData.get("branchId") || undefined,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const d = parsed.data;
    // Check email unique within tenant
    const existing = await db.user.findUnique({ where: { companyId_email: { companyId: s.tenantId!, email: d.email.toLowerCase() } } });
    if (existing) return { ok: false, error: "User with this email already exists" };
    // Generate temp password
    const bcrypt = await import("bcryptjs");
    const tempPassword = Math.random().toString(36).slice(-10);
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const u = await db.user.create({
      data: {
        companyId: s.tenantId!,
        email: d.email.toLowerCase(),
        name: d.name,
        role: d.role,
        passwordHash,
        status: "INVITED",
        forcePasswordChange: true,
      },
    });
    // If branch manager, assign to branch
    if (d.role === "BRANCH_MANAGER" && d.branchId) {
      await db.branch.update({ where: { id: d.branchId }, data: { managerId: u.id } });
    }
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "USER_INVITED", entityType: "User", entityId: u.id, reason: `Role: ${d.role}` });
    revalidatePath("/users");
    return { ok: true, tempPassword };
  } catch (e) {
    console.error("[actions] createUserAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}
