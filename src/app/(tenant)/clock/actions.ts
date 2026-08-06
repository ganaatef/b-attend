"use server";

/**
 * B-Attend clock-in/out + kiosk Server Actions — Phase 4.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logTenantEvent } from "@/lib/auth/audit";
import { haversineMeters, isInsideGeofence, recalculateAttendanceDay } from "@/lib/attendance/engine";

const ClockSchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(["CLOCK_IN", "CLOCK_OUT"]),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  source: z.enum(["MOBILE_WEB", "KIOSK"]).default("MOBILE_WEB"),
});

export async function clockAction(prev: any, formData: FormData) {
  try {
    const s = await getSession();
    if (!s) return { ok: false, error: "Not authenticated" };
    if (s.kind !== "tenant" || !s.tenantId) return { ok: false, error: "Not authenticated" };

    const parsed = ClockSchema.safeParse({
      employeeId: formData.get("employeeId"),
      type: formData.get("type"),
      latitude: formData.get("latitude"),
      longitude: formData.get("longitude"),
      source: formData.get("source") ?? "MOBILE_WEB",
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const d = parsed.data;

    // Find employee
    const employee = await db.employee.findUnique({
      where: { id: d.employeeId, companyId: s.tenantId },
      include: { branch: true },
    });
    if (!employee) return { ok: false, error: "Employee not found" };
    if (employee.status !== "ACTIVE") return { ok: false, error: "Employee is not active" };

    // For employee self-clock, ensure employee is clocking themselves
    if (s.role === "EMPLOYEE" && employee.userId !== s.sub) {
      return { ok: false, error: "You can only clock for yourself" };
    }

    // Find today's schedule
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const schedule = await db.schedule.findUnique({
      where: { companyId_employeeId_date: { companyId: employee.companyId, employeeId: employee.id, date: today } },
    });

    // Geofence check (skip for kiosk — assume inside)
    let distanceMeters = 0;
    let insideGeofence = true;
    if (d.source === "MOBILE_WEB" && employee.branch) {
      if (employee.branch.latitude && employee.branch.longitude) {
        distanceMeters = haversineMeters(d.latitude, d.longitude, employee.branch.latitude, employee.branch.longitude);
        insideGeofence = isInsideGeofence(distanceMeters, employee.branch.geofenceRadius);
      }
    }

    // Validate action sequence
    const existingPunches = await db.punch.findMany({
      where: { employeeId: employee.id, timestamp: { gte: today, lt: tomorrow } },
      orderBy: { timestamp: "desc" },
      take: 1,
    });
    const lastPunch = existingPunches[0];
    if (d.type === "CLOCK_IN" && lastPunch?.type === "CLOCK_IN") {
      return { ok: false, error: "Already clocked in. Clock out first." };
    }
    if (d.type === "CLOCK_OUT" && (!lastPunch || lastPunch.type !== "CLOCK_IN")) {
      return { ok: false, error: "Cannot clock out without clocking in first." };
    }

    // Create punch
    const punch = await db.punch.create({
      data: {
        companyId: employee.companyId,
        employeeId: employee.id,
        branchId: employee.branchId,
        scheduleId: schedule?.id,
        type: d.type,
        timestamp: new Date(),
        latitude: d.latitude,
        longitude: d.longitude,
        distanceMeters,
        insideGeofence,
        source: d.source,
        status: insideGeofence ? "ACCEPTED" : "NEEDS_APPROVAL",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "server",
      },
    });

    // Recalculate attendance day
    await recalculateAttendanceDay({ employeeId: employee.id, date: today });

    await logTenantEvent({
      companyId: employee.companyId,
      actorId: s.sub,
      actorEmail: s.email,
      action: d.type === "CLOCK_IN" ? "CLOCK_IN" : "CLOCK_OUT",
      entityType: "Punch",
      entityId: punch.id,
      reason: d.source === "KIOSK" ? "Kiosk clock" : "Mobile web clock",
      afterData: { insideGeofence, distanceMeters, status: punch.status },
    });

    revalidatePath("/clock");
    revalidatePath("/today");
    revalidatePath("/live");

    return {
      ok: true,
      punchId: punch.id,
      insideGeofence,
      distanceMeters,
      status: punch.status,
      type: d.type,
    };
  } catch (e) {
    console.error("[actions] clockAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

const KioskLookupSchema = z.object({
  branchId: z.string().min(1),
  code: z.string().optional(),
  pin: z.string().optional(),
});

export async function kioskLookupAction(prev: any, formData: FormData) {
  try {
    const s = await getSession();
    if (!s || s.kind !== "tenant" || !s.tenantId) return { ok: false, error: "Not authenticated" };
    const parsed = KioskLookupSchema.safeParse({
      branchId: formData.get("branchId"),
      code: formData.get("code") || undefined,
      pin: formData.get("pin") || undefined,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const d = parsed.data;
    // Verify branch belongs to tenant
    const branch = await db.branch.findFirst({ where: { id: d.branchId, companyId: s.tenantId } });
    if (!branch) return { ok: false, error: "Branch not found" };
    // Find employee
    const employee = await db.employee.findFirst({
      where: {
        companyId: s.tenantId,
        OR: [{ employeeCode: d.code }, { pinCode: d.pin }],
        status: "ACTIVE",
        deletedAt: null,
      },
      include: { branch: true, defaultShiftPolicy: true },
    });
    if (!employee) return { ok: false, error: "Employee not found. Check code/PIN." };
    // Get today's schedule
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const schedule = await db.schedule.findUnique({
      where: { companyId_employeeId_date: { companyId: s.tenantId, employeeId: employee.id, date: today } },
      include: { shiftPolicy: true },
    });
    // Last punch
    const lastPunch = await db.punch.findFirst({
      where: { employeeId: employee.id },
      orderBy: { timestamp: "desc" },
    });
    return {
      ok: true,
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        employeeCode: employee.employeeCode,
        jobTitle: employee.jobTitle,
        branchName: employee.branch?.name,
      },
      schedule: schedule ? {
        policyName: schedule.shiftPolicy?.name,
        expectedStart: schedule.expectedStart,
        expectedEnd: schedule.expectedEnd,
      } : null,
      lastPunch: lastPunch ? { type: lastPunch.type, timestamp: lastPunch.timestamp } : null,
      nextAction: !lastPunch || lastPunch.type === "CLOCK_OUT" ? "CLOCK_IN" : "CLOCK_OUT",
    };
  } catch (e) {
    console.error("[actions] kioskLookupAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}
