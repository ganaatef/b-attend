"use server";

/**
 * B-Attend clock-in/out + kiosk Server Actions — Phase 4.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { evaluatePermission } from "@/lib/auth/authorization";
import { logTenantEvent } from "@/lib/auth/audit";
import { haversineMeters, isInsideGeofence, recalculateAttendanceDay } from "@/lib/attendance/engine";
import { assessAttendanceTrust } from "@/lib/attendance/trust-engine";
import { attendanceTrustPolicyFromSettings } from "@/lib/attendance/trust-policy";
import { persistAttendanceTrustAssessment } from "@/lib/attendance/trust-persistence";
import { validateKioskDevice, verifyKioskCredentials, KIOSK_DEVICE_ERROR } from "@/lib/kiosk/kiosk-auth";

const ClockSchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(["CLOCK_IN", "CLOCK_OUT"]),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracyMeters: z.coerce.number().min(0).max(10_000).optional(),
  source: z.enum(["MOBILE_WEB", "KIOSK"]).default("MOBILE_WEB"),
  deviceIdentifier: z.string().optional(),
  deviceSecret: z.string().optional(),
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
      accuracyMeters: formData.get("accuracyMeters") || undefined,
      source: formData.get("source") ?? "MOBILE_WEB",
      deviceIdentifier: formData.get("deviceIdentifier") || undefined,
      deviceSecret: formData.get("deviceSecret") || undefined,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const d = parsed.data;

    const employee = await db.employee.findUnique({
      where: { id: d.employeeId, companyId: s.tenantId },
      include: { branch: true },
    });
    if (!employee) return { ok: false, error: "Employee not found" };
    if (employee.status !== "ACTIVE") return { ok: false, error: "Employee is not active" };

    // Browser/mobile-web punches are permission-scoped. Employees can clock only
    // themselves; delegated users need attendance.manage in the employee's
    // branch/department scope. Kiosk punches use independent device credentials.
    if (d.source === "MOBILE_WEB") {
      const isSelf = employee.userId === s.sub;
      const decision = await evaluatePermission({
        companyId: s.tenantId,
        userId: s.sub,
        legacyRole: s.role,
        permission: isSelf ? "attendance.self.clock" : "attendance.manage",
        scope: {
          branchId: employee.branchId,
          departmentId: employee.departmentId,
          targetUserId: employee.userId,
        },
      });
      if (!decision.allowed) {
        return {
          ok: false,
          error: s.role === "EMPLOYEE" && !isSelf
            ? "You can only clock for yourself"
            : "You do not have permission to clock for this employee",
        };
      }
    }

    if (d.source === "KIOSK") {
      if (!employee.branchId) return { ok: false, error: "Employee has no assigned branch" };
      const device = await validateKioskDevice({
        tenantId: s.tenantId,
        branchId: employee.branchId,
        deviceIdentifier: d.deviceIdentifier,
        deviceSecret: d.deviceSecret,
      });
      if (!device.ok) return { ok: false, error: KIOSK_DEVICE_ERROR };
    }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const [schedule, settings] = await Promise.all([
      db.schedule.findUnique({
        where: { companyId_employeeId_date: { companyId: employee.companyId, employeeId: employee.id, date: today } },
      }),
      db.companySettings.findUnique({ where: { companyId: employee.companyId } }),
    ]);

    let distanceMeters = 0;
    let insideGeofence = true;
    if (d.source === "MOBILE_WEB" && employee.branch) {
      if (employee.branch.latitude != null && employee.branch.longitude != null) {
        distanceMeters = haversineMeters(d.latitude, d.longitude, employee.branch.latitude, employee.branch.longitude);
        insideGeofence = isInsideGeofence(distanceMeters, employee.branch.geofenceRadius);
      }
    }

    // Rejected punches are forensic records, not part of the employee's valid
    // clock sequence. Pending-review punches remain sequence-active to prevent
    // duplicate retries while a manager decision is outstanding.
    const lastPunch = await db.punch.findFirst({
      where: {
        companyId: employee.companyId,
        employeeId: employee.id,
        status: { not: "REJECTED" },
        timestamp: { gte: today, lt: tomorrow },
      },
      orderBy: { timestamp: "desc" },
    });
    if (d.type === "CLOCK_IN" && lastPunch?.type === "CLOCK_IN") {
      return { ok: false, error: "Already clocked in. Clock out first." };
    }
    if (d.type === "CLOCK_OUT" && (!lastPunch || lastPunch.type !== "CLOCK_IN")) {
      return { ok: false, error: "Cannot clock out without clocking in first." };
    }

    const trustPolicy = attendanceTrustPolicyFromSettings(settings);
    const trust = assessAttendanceTrust({
      source: d.source,
      insideGeofence,
      distanceMeters,
      accuracyMeters: d.source === "MOBILE_WEB" ? (d.accuracyMeters ?? null) : null,
      deviceTrusted: d.source === "KIOSK" ? true : null,
    }, trustPolicy);
    const geofenceReviewRequired = !insideGeofence && (settings?.requireApprovalOutsideGeofence ?? true);
    const needsApproval = trust.decision === "REVIEW" || geofenceReviewRequired;
    const punchStatus = trust.decision === "REJECT"
      ? "REJECTED" as const
      : needsApproval
        ? "NEEDS_APPROVAL" as const
        : "ACCEPTED" as const;
    const persistedTrust = {
      policyVersion: trust.policyVersion,
      score: trust.score,
      riskLevel: trust.riskLevel,
      decision: trust.decision,
      criticalRisk: trust.criticalRisk,
      signals: trust.signals,
    };

    // Punch + trust evidence + review request are one atomic domain transition.
    const punch = await db.$transaction(async (tx) => {
      const created = await tx.punch.create({
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
          status: punchStatus,
          deviceInfo: JSON.stringify({
            platform: d.source,
            accuracyMeters: d.accuracyMeters ?? null,
            trust: persistedTrust,
          }),
          userAgent: "server-action",
        },
      });

      await persistAttendanceTrustAssessment(tx, {
        companyId: employee.companyId,
        punchId: created.id,
        source: d.source,
        assessment: trust,
        reviewStatus: punchStatus === "NEEDS_APPROVAL" ? "PENDING" : "NOT_REQUIRED",
      });

      if (punchStatus === "NEEDS_APPROVAL") {
        await tx.approvalRequest.create({
          data: {
            companyId: employee.companyId,
            employeeId: employee.id,
            branchId: employee.branchId,
            date: today,
            type: insideGeofence ? "ATTENDANCE_ADJUSTMENT" : "OUTSIDE_GEOFENCE",
            reason: insideGeofence
              ? `Attendance Trust Engine review (${trust.riskLevel}, ${trust.score}/100)`
              : `Outside geofence (${Math.round(distanceMeters)}m) — Trust ${trust.score}/100`,
            originalData: JSON.stringify({
              punchType: d.type,
              latitude: d.latitude,
              longitude: d.longitude,
              distanceMeters,
              insideGeofence,
            }),
            requestedData: JSON.stringify({ trust: persistedTrust }),
            status: "PENDING",
            requestedById: s.sub,
            relatedPunchId: created.id,
          },
        });
      }

      return created;
    });

    await recalculateAttendanceDay({ employeeId: employee.id, date: today });

    await logTenantEvent({
      companyId: employee.companyId,
      actorId: s.sub,
      actorEmail: s.email,
      action: d.type === "CLOCK_IN" ? "CLOCK_IN" : "CLOCK_OUT",
      entityType: "Punch",
      entityId: punch.id,
      reason: d.source === "KIOSK" ? "Kiosk clock" : "Mobile web clock",
      afterData: {
        insideGeofence,
        distanceMeters,
        status: punch.status,
        trustScore: trust.score,
        trustRisk: trust.riskLevel,
        trustDecision: trust.decision,
        trustPolicyVersion: trust.policyVersion,
        approvalCreated: punchStatus === "NEEDS_APPROVAL",
      },
    });

    revalidatePath("/clock");
    revalidatePath("/today");
    revalidatePath("/live");
    revalidatePath("/approvals");
    revalidatePath("/dashboard");

    return {
      ok: true,
      punchId: punch.id,
      insideGeofence,
      distanceMeters,
      status: punch.status,
      type: d.type,
      trust: {
        score: trust.score,
        riskLevel: trust.riskLevel,
        decision: trust.decision,
        reasons: trust.reasons,
        policyVersion: trust.policyVersion,
      },
      approvalRequired: punchStatus === "NEEDS_APPROVAL",
    };
  } catch (e) {
    console.error("[actions] clockAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

const KioskLookupSchema = z.object({
  branchId: z.string().min(1),
  code: z.string().min(1),
  pin: z.string().min(1),
  deviceIdentifier: z.string().min(1),
  deviceSecret: z.string().min(1),
});

export type KioskLookupResult =
  | {
      ok: true;
      employee: {
        id: string;
        fullName: string;
        employeeCode: string;
        jobTitle: string | null;
        branchName: string | null;
      };
      schedule: { policyName: string | null; expectedStart: Date | null; expectedEnd: Date | null } | null;
      lastPunch: { type: string; timestamp: Date } | null;
      nextAction: "CLOCK_IN" | "CLOCK_OUT";
    }
  | { ok: false; error: string };

export async function kioskLookupAction(prev: any, formData: FormData): Promise<KioskLookupResult> {
  try {
    const s = await getSession();
    if (!s || s.kind !== "tenant" || !s.tenantId) return { ok: false, error: "Not authenticated" };
    const parsed = KioskLookupSchema.safeParse({
      branchId: formData.get("branchId"),
      code: formData.get("code") || undefined,
      pin: formData.get("pin") || undefined,
      deviceIdentifier: formData.get("deviceIdentifier") || undefined,
      deviceSecret: formData.get("deviceSecret") || undefined,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const d = parsed.data;

    const branch = await db.branch.findFirst({ where: { id: d.branchId, companyId: s.tenantId } });
    if (!branch) return { ok: false, error: "Branch not found" };

    const auth = await verifyKioskCredentials({
      tenantId: s.tenantId,
      branchId: d.branchId,
      deviceIdentifier: d.deviceIdentifier,
      deviceSecret: d.deviceSecret,
      code: d.code,
      pin: d.pin,
    });
    if (!auth.ok) return { ok: false, error: auth.error };

    const employee = await db.employee.findUnique({
      where: { id: auth.employeeId },
      include: { branch: true, defaultShiftPolicy: true },
    });
    if (!employee) return { ok: false, error: "Employee not found. Check code/PIN." };

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const schedule = await db.schedule.findUnique({
      where: { companyId_employeeId_date: { companyId: s.tenantId, employeeId: employee.id, date: today } },
      include: { shiftPolicy: true },
    });
    const lastPunch = await db.punch.findFirst({
      where: {
        companyId: s.tenantId,
        employeeId: employee.id,
        status: { not: "REJECTED" },
        timestamp: { gte: today, lt: tomorrow },
      },
      orderBy: { timestamp: "desc" },
    });
    return {
      ok: true,
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        employeeCode: employee.employeeCode,
        jobTitle: employee.jobTitle,
        branchName: employee.branch?.name ?? null,
      },
      schedule: schedule ? {
        policyName: schedule.shiftPolicy?.name ?? null,
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
