"use server";

/**
 * B-Attend tenant entity Server Actions — Phase 3.
 * Branches, departments, employees, shift policies, schedules (single + bulk).
 * All actions enforce tenant session + companyId scoping.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logTenantEvent } from "@/lib/auth/audit";

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

// ─────────────────────────────────────────────
// Onboarding
// ─────────────────────────────────────────────

const OnboardingStep1Schema = z.object({
  industry: z.string().optional(),
  timezone: z.string().default("Africa/Cairo"),
  currency: z.string().default("EGP"),
  defaultLanguage: z.string().default("en"),
});

export async function onboardingStep1Action(prev: any, formData: FormData) {
  try {
    const s = await requireTenant();
    const parsed = OnboardingStep1Schema.safeParse({
      industry: formData.get("industry") || undefined,
      timezone: formData.get("timezone"),
      currency: formData.get("currency"),
      defaultLanguage: formData.get("defaultLanguage"),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const d = parsed.data;
    await db.companySettings.upsert({
      where: { companyId: s.tenantId! },
      update: { industry: d.industry, timezone: d.timezone, currency: d.currency, defaultLanguage: d.defaultLanguage },
      create: { companyId: s.tenantId!, industry: d.industry, timezone: d.timezone, currency: d.currency, defaultLanguage: d.defaultLanguage },
    });
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "SETTINGS_UPDATED", entityType: "CompanySettings", reason: "Onboarding step 1" });
    revalidatePath("/onboarding");
    return { ok: true };
  } catch (e) {
    console.error("[actions] onboardingStep1Action failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

const OnboardingStep2Schema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  area: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  geofenceRadius: z.coerce.number().int().min(50).max(2000).default(150),
});

export async function onboardingCreateBranchAction(prev: any, formData: FormData) {
  try {
    const s = await requireTenant();
    const parsed = OnboardingStep2Schema.safeParse({
      name: formData.get("name"),
      code: formData.get("code"),
      address: formData.get("address") || undefined,
      city: formData.get("city") || undefined,
      area: formData.get("area") || undefined,
      latitude: formData.get("latitude") || undefined,
      longitude: formData.get("longitude") || undefined,
      geofenceRadius: formData.get("geofenceRadius"),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const d = parsed.data;
    // Plan limit check
    const tenant = await db.tenant.findUnique({ where: { id: s.tenantId! }, include: { subscription: { include: { plan: true } } } });
    if (tenant?.subscription?.plan) {
      const count = await db.branch.count({ where: { companyId: s.tenantId!, deletedAt: null } });
      if (count >= tenant.subscription.plan.maxBranches) {
        return { ok: false, error: `Plan limit reached (${tenant.subscription.plan.maxBranches} branches). Upgrade to add more.` };
      }
    }
    const branch = await db.branch.create({ data: { companyId: s.tenantId!, ...d, status: "ACTIVE" } });
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "BRANCH_CREATED", entityType: "Branch", entityId: branch.id, afterData: d });
    revalidatePath("/onboarding");
    revalidatePath("/branches");
    return { ok: true };
  } catch (e) {
    console.error("[actions] onboardingCreateBranchAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

const OnboardingStep3Schema = z.object({
  names: z.string().min(1), // comma-separated
});

export async function onboardingCreateDepartmentsAction(prev: any, formData: FormData) {
  try {
    const s = await requireTenant();
    const parsed = OnboardingStep3Schema.safeParse({ names: formData.get("names") });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const names = parsed.data.names.split(",").map((n) => n.trim()).filter(Boolean);
    let count = 0;
    for (const name of names) {
      const existing = await db.department.findFirst({ where: { companyId: s.tenantId!, name } });
      if (!existing) {
        await db.department.create({ data: { companyId: s.tenantId!, name, code: name.slice(0, 3).toUpperCase() } });
        count++;
      }
    }
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "DEPARTMENT_CREATED", reason: `Created ${count} departments` });
    revalidatePath("/onboarding");
    revalidatePath("/departments");
    return { ok: true };
  } catch (e) {
    console.error("[actions] onboardingCreateDepartmentsAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

const OnboardingStep4Schema = z.object({
  name: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  breakMinutes: z.coerce.number().int().min(0).default(0),
  lateGraceMinutes: z.coerce.number().int().min(0).default(10),
  earlyLeaveGraceMinutes: z.coerce.number().int().min(0).default(0),
  overtimeStartsAfterMinutes: z.coerce.number().int().min(0).default(480),
});

export async function onboardingCreatePolicyAction(prev: any, formData: FormData) {
  try {
    const s = await requireTenant();
    const parsed = OnboardingStep4Schema.safeParse({
      name: formData.get("name"),
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime"),
      breakMinutes: formData.get("breakMinutes"),
      lateGraceMinutes: formData.get("lateGraceMinutes"),
      earlyLeaveGraceMinutes: formData.get("earlyLeaveGraceMinutes"),
      overtimeStartsAfterMinutes: formData.get("overtimeStartsAfterMinutes"),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const d = parsed.data;
    const policy = await db.shiftPolicy.create({ data: { companyId: s.tenantId!, ...d, weekendDays: "FRIDAY,SATURDAY", requiresOvertimeApproval: true, allowsMobileClockIn: true, allowsKioskClockIn: true, allowNoScheduleClockIn: false, status: "ACTIVE" } });
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "SHIFT_POLICY_CREATED", entityType: "ShiftPolicy", entityId: policy.id });
    revalidatePath("/onboarding");
    revalidatePath("/policies");
    return { ok: true };
  } catch (e) {
    console.error("[actions] onboardingCreatePolicyAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

// ─────────────────────────────────────────────
// Branches CRUD
// ─────────────────────────────────────────────

const BranchSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  area: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  geofenceRadius: z.coerce.number().int().min(50).max(2000).default(150),
});

export async function createBranchAction(prev: any, formData: FormData) {
  try {
    const s = await requireTenantAdmin();
    const parsed = BranchSchema.safeParse({
      name: formData.get("name"), code: formData.get("code"),
      address: formData.get("address") || undefined, city: formData.get("city") || undefined, area: formData.get("area") || undefined,
      latitude: formData.get("latitude") || undefined, longitude: formData.get("longitude") || undefined,
      geofenceRadius: formData.get("geofenceRadius"),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const d = parsed.data;
    const tenant = await db.tenant.findUnique({ where: { id: s.tenantId! }, include: { subscription: { include: { plan: true } } } });
    if (tenant?.subscription?.plan) {
      const count = await db.branch.count({ where: { companyId: s.tenantId!, deletedAt: null } });
      if (count >= tenant.subscription.plan.maxBranches) return { ok: false, error: `Plan limit reached (${tenant.subscription.plan.maxBranches} branches).` };
    }
    const branch = await db.branch.create({ data: { companyId: s.tenantId!, ...d, status: "ACTIVE" } });
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "BRANCH_CREATED", entityType: "Branch", entityId: branch.id });
    revalidatePath("/branches");
    return { ok: true };
  } catch (e) {
    console.error("[actions] createBranchAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function updateBranchAction(branchId: string, data: Record<string, any>) {
  try {
    const s = await requireTenantAdmin();
    const branch = await db.branch.findFirst({ where: { id: branchId, companyId: s.tenantId! } });
    if (!branch) return { ok: false, error: "Branch not found" };
    const allowed = ["name", "code", "address", "city", "area", "latitude", "longitude", "geofenceRadius", "status"];
    const safeData: Record<string, any> = {};
    for (const key of allowed) {
      if (key in data) safeData[key] = data[key];
    }
    await db.branch.update({ where: { id: branchId, companyId: s.tenantId! }, data: safeData });
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "BRANCH_EDITED", entityType: "Branch", entityId: branchId });
    revalidatePath("/branches");
    revalidatePath(`/branches/${branchId}`);
    return { ok: true };
  } catch (e) {
    console.error("[actions] updateBranchAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function deleteBranchAction(branchId: string) {
  try {
    const s = await requireTenantAdmin();
    const branch = await db.branch.findFirst({ where: { id: branchId, companyId: s.tenantId! } });
    if (!branch) return { ok: false, error: "Branch not found" };
    await db.branch.update({ where: { id: branchId }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "BRANCH_EDITED", entityType: "Branch", entityId: branchId, reason: "Archived" });
    revalidatePath("/branches");
    return { ok: true };
  } catch (e) {
    console.error("[actions] deleteBranchAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

// ─────────────────────────────────────────────
// Departments CRUD
// ─────────────────────────────────────────────

export async function createDepartmentAction(prev: any, formData: FormData) {
  try {
    const s = await requireTenantAdmin();
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { ok: false, error: "Name is required" };
    const existing = await db.department.findFirst({ where: { companyId: s.tenantId!, name } });
    if (existing) return { ok: false, error: "Department already exists" };
    await db.department.create({ data: { companyId: s.tenantId!, name, code: name.slice(0, 3).toUpperCase() } });
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "DEPARTMENT_CREATED", entityType: "Department" });
    revalidatePath("/departments");
    return { ok: true };
  } catch (e) {
    console.error("[actions] createDepartmentAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function deleteDepartmentAction(departmentId: string) {
  try {
    const s = await requireTenantAdmin();
    await db.department.deleteMany({ where: { id: departmentId, companyId: s.tenantId! } });
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "DEPARTMENT_DELETED", entityType: "Department", entityId: departmentId });
    revalidatePath("/departments");
    return { ok: true };
  } catch (e) {
    console.error("[actions] deleteDepartmentAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

// ─────────────────────────────────────────────
// Employees CRUD
// ─────────────────────────────────────────────

const EmployeeSchema = z.object({
  employeeCode: z.string().min(1),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  jobTitle: z.string().optional(),
  branchId: z.string().min(1),
  departmentId: z.string().optional(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "DAILY_WORKER", "TEMPORARY", "CONTRACTOR"]).default("FULL_TIME"),
  defaultShiftPolicyId: z.string().optional(),
  pinCode: z.string().optional(),
});

export async function createEmployeeAction(prev: any, formData: FormData) {
  try {
    const s = await requireTenantAdmin();
    const parsed = EmployeeSchema.safeParse({
      employeeCode: formData.get("employeeCode"),
      fullName: formData.get("fullName"),
      phone: formData.get("phone") || undefined,
      email: formData.get("email") || "",
      jobTitle: formData.get("jobTitle") || undefined,
      branchId: formData.get("branchId"),
      departmentId: formData.get("departmentId") || undefined,
      employmentType: formData.get("employmentType"),
      defaultShiftPolicyId: formData.get("defaultShiftPolicyId") || undefined,
      pinCode: formData.get("pinCode") || undefined,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const d = parsed.data;
    // Plan limit
    const tenant = await db.tenant.findUnique({ where: { id: s.tenantId! }, include: { subscription: { include: { plan: true } } } });
    if (tenant?.subscription?.plan) {
      const count = await db.employee.count({ where: { companyId: s.tenantId!, deletedAt: null } });
      if (count >= tenant.subscription.plan.maxEmployees) return { ok: false, error: `Plan limit reached (${tenant.subscription.plan.maxEmployees} employees).` };
    }
    // Unique employee code
    const existing = await db.employee.findUnique({ where: { companyId_employeeCode: { companyId: s.tenantId!, employeeCode: d.employeeCode } } });
    if (existing) return { ok: false, error: "Employee code already exists" };
    // Validate branch belongs to tenant
    const branch = await db.branch.findFirst({ where: { id: d.branchId, companyId: s.tenantId!, deletedAt: null } });
    if (!branch) return { ok: false, error: "Branch not found or does not belong to your company" };
    // Validate department if provided
    if (d.departmentId) {
      const dept = await db.department.findFirst({ where: { id: d.departmentId, companyId: s.tenantId! } });
      if (!dept) return { ok: false, error: "Department not found or does not belong to your company" };
    }
    // Validate shift policy if provided
    if (d.defaultShiftPolicyId) {
      const policy = await db.shiftPolicy.findFirst({ where: { id: d.defaultShiftPolicyId, companyId: s.tenantId! } });
      if (!policy) return { ok: false, error: "Shift policy not found or does not belong to your company" };
    }
    const emp = await db.employee.create({
      data: {
        companyId: s.tenantId!,
        employeeCode: d.employeeCode,
        fullName: d.fullName,
        phone: d.phone || null,
        email: d.email || null,
        jobTitle: d.jobTitle || null,
        branchId: d.branchId,
        departmentId: d.departmentId || null,
        employmentType: d.employmentType,
        defaultShiftPolicyId: d.defaultShiftPolicyId || null,
        pinCode: d.pinCode || null,
        status: "ACTIVE",
        startDate: new Date(),
      },
    });
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "EMPLOYEE_CREATED", entityType: "Employee", entityId: emp.id });
    revalidatePath("/employees");
    return { ok: true };
  } catch (e) {
    console.error("[actions] createEmployeeAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function updateEmployeeAction(employeeId: string, data: Record<string, any>) {
  try {
    const s = await requireTenantAdmin();
    const emp = await db.employee.findFirst({ where: { id: employeeId, companyId: s.tenantId! } });
    if (!emp) return { ok: false, error: "Employee not found" };
    const allowed = ["fullName", "arabicName", "phone", "email", "jobTitle", "branchId", "departmentId", "employmentType", "defaultShiftPolicyId", "pinCode", "status", "employeeCode"];
    const safeData: Record<string, any> = {};
    for (const key of allowed) {
      if (key in data) safeData[key] = data[key];
    }
    if (safeData.branchId) {
      const branch = await db.branch.findFirst({ where: { id: safeData.branchId, companyId: s.tenantId!, deletedAt: null } });
      if (!branch) return { ok: false, error: "Branch not found or does not belong to your company" };
    }
    await db.employee.update({ where: { id: employeeId, companyId: s.tenantId! }, data: safeData });
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "EMPLOYEE_EDITED", entityType: "Employee", entityId: employeeId });
    revalidatePath("/employees");
    revalidatePath(`/employees/${employeeId}`);
    return { ok: true };
  } catch (e) {
    console.error("[actions] updateEmployeeAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function deleteEmployeeAction(employeeId: string) {
  try {
    const s = await requireTenantAdmin();
    await db.employee.update({ where: { id: employeeId, companyId: s.tenantId! }, data: { deletedAt: new Date(), status: "LEFT" } });
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "EMPLOYEE_EDITED", entityType: "Employee", entityId: employeeId, reason: "Deactivated" });
    revalidatePath("/employees");
    return { ok: true };
  } catch (e) {
    console.error("[actions] deleteEmployeeAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

// ─────────────────────────────────────────────
// Shift policies CRUD
// ─────────────────────────────────────────────

const PolicySchema = z.object({
  name: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  breakMinutes: z.coerce.number().int().min(0).default(0),
  lateGraceMinutes: z.coerce.number().int().min(0).default(10),
  earlyLeaveGraceMinutes: z.coerce.number().int().min(0).default(0),
  overtimeStartsAfterMinutes: z.coerce.number().int().min(0).default(480),
  weekendDays: z.string().default("FRIDAY,SATURDAY"),
  requiresOvertimeApproval: z.enum(["true", "false"]).or(z.boolean()).default(true),
  allowsMobileClockIn: z.enum(["true", "false"]).or(z.boolean()).default(true),
  allowsKioskClockIn: z.enum(["true", "false"]).or(z.boolean()).default(true),
  allowNoScheduleClockIn: z.enum(["true", "false"]).or(z.boolean()).default(false),
});

export async function createPolicyAction(prev: any, formData: FormData) {
  try {
    const s = await requireTenantAdmin();
    const parsed = PolicySchema.safeParse({
      name: formData.get("name"),
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime"),
      breakMinutes: formData.get("breakMinutes"),
      lateGraceMinutes: formData.get("lateGraceMinutes"),
      earlyLeaveGraceMinutes: formData.get("earlyLeaveGraceMinutes"),
      overtimeStartsAfterMinutes: formData.get("overtimeStartsAfterMinutes"),
      weekendDays: formData.get("weekendDays"),
      requiresOvertimeApproval: formData.get("requiresOvertimeApproval") ?? "true",
      allowsMobileClockIn: formData.get("allowsMobileClockIn") ?? "true",
      allowsKioskClockIn: formData.get("allowsKioskClockIn") ?? "true",
      allowNoScheduleClockIn: formData.get("allowNoScheduleClockIn") ?? "false",
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const d: any = parsed.data;
    d.requiresOvertimeApproval = d.requiresOvertimeApproval === true || d.requiresOvertimeApproval === "true";
    d.allowsMobileClockIn = d.allowsMobileClockIn === true || d.allowsMobileClockIn === "true";
    d.allowsKioskClockIn = d.allowsKioskClockIn === true || d.allowsKioskClockIn === "true";
    d.allowNoScheduleClockIn = d.allowNoScheduleClockIn === true || d.allowNoScheduleClockIn === "true";
    const policy = await db.shiftPolicy.create({ data: { companyId: s.tenantId!, ...d, status: "ACTIVE" } });
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "SHIFT_POLICY_CREATED", entityType: "ShiftPolicy", entityId: policy.id });
    revalidatePath("/policies");
    return { ok: true };
  } catch (e) {
    console.error("[actions] createPolicyAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

// ─────────────────────────────────────────────
// Schedules — single + bulk
// ─────────────────────────────────────────────

import { getManagedBranchIds } from "@/lib/hr/permissions";

function isManager(role: string) { return role === "BRANCH_MANAGER"; }

const ScheduleSchema = z.object({
  employeeId: z.string().min(1),
  branchId: z.string().min(1),
  date: z.string().min(1),
  shiftPolicyId: z.string().min(1),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
});

export async function createScheduleAction(prev: any, formData: FormData) {
  try {
    const s = await requireTenant();
    const parsed = ScheduleSchema.safeParse({
      employeeId: formData.get("employeeId"),
      branchId: formData.get("branchId"),
      date: formData.get("date"),
      shiftPolicyId: formData.get("shiftPolicyId"),
      plannedStart: formData.get("plannedStart") || undefined,
      plannedEnd: formData.get("plannedEnd") || undefined,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const d = parsed.data;

    const employee = await db.employee.findFirst({ where: { id: d.employeeId, companyId: s.tenantId!, deletedAt: null } });
    if (!employee) return { ok: false, error: "Employee not found or inactive" };

    if (isManager(s.role!)) {
      const managedBranches = await getManagedBranchIds(s.sub, s.tenantId!);
      if (!managedBranches.includes(d.branchId)) return { ok: false, error: "Cannot schedule for branches you don't manage" };
      if (employee.branchId !== d.branchId) return { ok: false, error: "Employee must belong to the selected branch" };
    }

    const date = new Date(d.date);
    date.setHours(0, 0, 0, 0);
    const policy = await db.shiftPolicy.findFirst({ where: { id: d.shiftPolicyId, companyId: s.tenantId! } });
    if (!policy) return { ok: false, error: "Shift policy not found" };

    let expectedStart: Date, expectedEnd: Date;
    if (d.plannedStart && d.plannedEnd) {
      const [psh, psm] = d.plannedStart.split(":").map(Number);
      const [peh, pem] = d.plannedEnd.split(":").map(Number);
      expectedStart = new Date(date); expectedStart.setHours(psh, psm, 0, 0);
      expectedEnd = new Date(date); expectedEnd.setHours(peh, pem, 0, 0);
      if (expectedEnd <= expectedStart) expectedEnd.setDate(expectedEnd.getDate() + 1);
    } else {
      const [sh, sm] = policy.startTime.split(":").map(Number);
      const [eh, em] = policy.endTime.split(":").map(Number);
      expectedStart = new Date(date); expectedStart.setHours(sh, sm, 0, 0);
      expectedEnd = new Date(date); expectedEnd.setHours(eh, em, 0, 0);
      if (expectedEnd <= expectedStart) expectedEnd.setDate(expectedEnd.getDate() + 1);
    }

    const existing = await db.schedule.findUnique({ where: { companyId_employeeId_date: { companyId: s.tenantId!, employeeId: d.employeeId, date } } });
    if (existing) return { ok: false, error: "Schedule already exists for this employee on this date." };

    const overlaps = await db.schedule.findMany({
      where: { companyId: s.tenantId!, employeeId: d.employeeId, expectedStart: { lt: expectedEnd }, expectedEnd: { gt: expectedStart } },
    });
    if (overlaps.length > 0) return { ok: false, error: "Schedule overlaps with an existing shift for this employee" };

    try {
      await db.schedule.create({
        data: { companyId: s.tenantId!, employeeId: d.employeeId, branchId: d.branchId, date, shiftPolicyId: d.shiftPolicyId, expectedStart, expectedEnd, status: "SCHEDULED" },
      });
      await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "SCHEDULE_CREATED", entityType: "Schedule" });
    } catch (e: any) {
      if (e?.code === "P2002") return { ok: false, error: "Schedule already exists for this employee on this date." };
      throw e;
    }
    revalidatePath("/schedules");
    revalidatePath("/my-schedule");
    return { ok: true };
  } catch (e) {
    console.error("[actions] createScheduleAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function updateScheduleAction(scheduleId: string, data: { shiftPolicyId?: string; plannedStart?: string; plannedEnd?: string; notes?: string; status?: string }) {
  try {
    const s = await requireTenant();
    const schedule = await db.schedule.findFirst({ where: { id: scheduleId, companyId: s.tenantId! } });
    if (!schedule) return { ok: false, error: "Schedule not found" };

    if (isManager(s.role!) && schedule.branchId) {
      const managedBranches = await getManagedBranchIds(s.sub, s.tenantId!);
      if (!managedBranches.includes(schedule.branchId)) return { ok: false, error: "Cannot edit schedules for branches you don't manage" };
    }

    const updates: any = {};

    if (data.shiftPolicyId) {
      const policy = await db.shiftPolicy.findFirst({ where: { id: data.shiftPolicyId, companyId: s.tenantId! } });
      if (!policy) return { ok: false, error: "Shift policy not found" };
      updates.shiftPolicyId = data.shiftPolicyId;
      if (!data.plannedStart && !data.plannedEnd) {
        const date = new Date(schedule.date);
        const [sh, sm] = policy.startTime.split(":").map(Number);
        const [eh, em] = policy.endTime.split(":").map(Number);
        const expectedStart = new Date(date); expectedStart.setHours(sh, sm, 0, 0);
        const expectedEnd = new Date(date); expectedEnd.setHours(eh, em, 0, 0);
        if (expectedEnd <= expectedStart) expectedEnd.setDate(expectedEnd.getDate() + 1);
        updates.expectedStart = expectedStart;
        updates.expectedEnd = expectedEnd;
      }
    }

    if (data.plannedStart && data.plannedEnd) {
      const date = new Date(schedule.date);
      const [psh, psm] = data.plannedStart.split(":").map(Number);
      const [peh, pem] = data.plannedEnd.split(":").map(Number);
      const expectedStart = new Date(date); expectedStart.setHours(psh, psm, 0, 0);
      const expectedEnd = new Date(date); expectedEnd.setHours(peh, pem, 0, 0);
      if (expectedEnd <= expectedStart) expectedEnd.setDate(expectedEnd.getDate() + 1);
      updates.expectedStart = expectedStart;
      updates.expectedEnd = expectedEnd;
    }

    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.status) updates.status = data.status;

    await db.schedule.update({ where: { id: scheduleId }, data: updates });
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "SCHEDULE_EDITED", entityType: "Schedule", entityId: scheduleId });
    revalidatePath("/schedules");
    revalidatePath("/my-schedule");
    return { ok: true };
  } catch (e) {
    console.error("[actions] updateScheduleAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

const BulkScheduleSchema = z.object({
  branchId: z.string().min(1),
  employeeIds: z.string().min(1),
  dateFrom: z.string().min(1),
  dateTo: z.string().min(1),
  shiftPolicyId: z.string().min(1),
  weekendDays: z.string().default("FRIDAY,SATURDAY"),
});

export async function bulkScheduleAction(prev: any, formData: FormData) {
  try {
    const s = await requireTenant();
    const parsed = BulkScheduleSchema.safeParse({
      branchId: formData.get("branchId"),
      employeeIds: formData.get("employeeIds"),
      dateFrom: formData.get("dateFrom"),
      dateTo: formData.get("dateTo"),
      shiftPolicyId: formData.get("shiftPolicyId"),
      weekendDays: formData.get("weekendDays") || "FRIDAY,SATURDAY",
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const d = parsed.data;
    const employeeIds = d.employeeIds.split(",").filter(Boolean);
    if (employeeIds.length === 0) return { ok: false, error: "Select at least one employee" };
    const policy = await db.shiftPolicy.findFirst({ where: { id: d.shiftPolicyId, companyId: s.tenantId! } });
    if (!policy) return { ok: false, error: "Shift policy not found" };

    if (isManager(s.role!)) {
      const managedBranches = await getManagedBranchIds(s.sub, s.tenantId!);
      if (!managedBranches.includes(d.branchId)) return { ok: false, error: "Cannot schedule for branches you don't manage" };
      const branchEmps = await db.employee.findMany({ where: { companyId: s.tenantId!, branchId: d.branchId, deletedAt: null }, select: { id: true } });
      const allowedIds = new Set(branchEmps.map((e) => e.id));
      const invalid = employeeIds.filter((id) => !allowedIds.has(id));
      if (invalid.length > 0) return { ok: false, error: "Some employees do not belong to the selected branch" };
    }

    const weekendSet = new Set(d.weekendDays.split(",").map((x) => x.trim()));
    const dayMap: Record<string, number> = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };
    const weekendNums = new Set([...weekendSet].map((dd) => dayMap[dd] ?? -1).filter((x) => x >= 0));
    const start = new Date(d.dateFrom); start.setHours(0, 0, 0, 0);
    const end = new Date(d.dateTo); end.setHours(0, 0, 0, 0);
    if (end < start) return { ok: false, error: "End date must be after start date" };

    const [sh, sm] = policy.startTime.split(":").map(Number);
    const [eh, em] = policy.endTime.split(":").map(Number);

    let created = 0;
    let skipped = 0;
    let conflicts = 0;
    for (const empId of employeeIds) {
      for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
        if (weekendNums.has(dt.getDay())) continue;
        const date = new Date(dt);
        const existing = await db.schedule.findUnique({ where: { companyId_employeeId_date: { companyId: s.tenantId!, employeeId: empId, date } } });
        if (existing) { skipped++; continue; }
        const expectedStart = new Date(date); expectedStart.setHours(sh, sm, 0, 0);
        const expectedEnd = new Date(date); expectedEnd.setHours(eh, em, 0, 0);
        if (expectedEnd <= expectedStart) expectedEnd.setDate(expectedEnd.getDate() + 1);
        const overlap = await db.schedule.findFirst({
          where: { companyId: s.tenantId!, employeeId: empId, expectedStart: { lt: expectedEnd }, expectedEnd: { gt: expectedStart } },
        });
        if (overlap) { conflicts++; continue; }
        await db.schedule.create({ data: { companyId: s.tenantId!, employeeId: empId, branchId: d.branchId, date, shiftPolicyId: d.shiftPolicyId, expectedStart, expectedEnd, status: "SCHEDULED" } });
        created++;
      }
    }
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "SCHEDULE_GENERATED", reason: `Bulk: created ${created}, skipped ${skipped}, conflicts ${conflicts}` });
    revalidatePath("/schedules");
    revalidatePath("/my-schedule");
    return { ok: true, created, skipped, conflicts };
  } catch (e) {
    console.error("[actions] bulkScheduleAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function deleteScheduleAction(scheduleId: string) {
  try {
    const s = await requireTenant();
    const schedule = await db.schedule.findFirst({ where: { id: scheduleId, companyId: s.tenantId! } });
    if (!schedule) return { ok: false, error: "Schedule not found" };
    if (typeof s.role === "string" && isManager(s.role) && schedule.branchId) {
      const managedBranches = await getManagedBranchIds(s.sub, s.tenantId!);
      if (!managedBranches.includes(schedule.branchId)) return { ok: false, error: "Cannot delete schedule for branches you don't manage" };
    }
    await db.schedule.delete({ where: { id: scheduleId } });
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "SCHEDULE_DELETED", entityType: "Schedule", entityId: scheduleId });
    revalidatePath("/schedules");
    revalidatePath("/my-schedule");
    return { ok: true };
  } catch (e) {
    console.error("[actions] deleteScheduleAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}
