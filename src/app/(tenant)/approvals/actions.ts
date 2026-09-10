"use server";

/**
 * B-Attend approvals Server Actions — Phase 5.
 *
 * Employee submits request → authorized manager/HR approves/rejects → side effects on AttendanceDay.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { evaluatePermission } from "@/lib/auth/authorization";
import { logTenantEvent } from "@/lib/auth/audit";
import { recalculateAttendanceDay } from "@/lib/attendance/engine";
import { getManagedBranchIds } from "@/lib/hr/permissions";

async function requireTenant() {
  const s = await getSession();
  if (!s || s.kind !== "tenant" || !s.tenantId) throw new Error("FORBIDDEN");
  // Re-materialize tenantId as a required string so TypeScript carries the
  // runtime guard across action boundaries instead of widening it back to the
  // optional session shape.
  return { ...s, tenantId: s.tenantId };
}

function isLeaveRequest(type: string) {
  return type === "LEAVE_REQUEST";
}

function requestPermission(type: string, mode: "self" | "manage" | "approve") {
  if (isLeaveRequest(type)) {
    if (mode === "self") return "leave.self.request" as const;
    if (mode === "manage") return "leave.manage" as const;
    return "leave.approve" as const;
  }
  if (mode === "self") return "attendance.self.request" as const;
  if (mode === "manage") return "attendance.manage" as const;
  return "attendance.approve" as const;
}

// ─────────────────────────────────────────────
// Submit request
// ─────────────────────────────────────────────

const SubmitRequestSchema = z.object({
  type: z.enum(["MANUAL_CLOCK_IN", "MANUAL_CLOCK_OUT", "OUTSIDE_GEOFENCE", "MISSING_CLOCK_OUT", "OVERTIME", "ATTENDANCE_ADJUSTMENT", "LEAVE_REQUEST", "PERMISSION_REQUEST"]),
  employeeId: z.string().min(1),
  branchId: z.string().optional(),
  date: z.string().min(1),
  reason: z.string().min(5, "Provide a clear reason (at least 5 characters)"),
  requestedClockIn: z.string().optional(),
  requestedClockOut: z.string().optional(),
  dateTo: z.string().optional(),
  fromTime: z.string().optional(),
  toTime: z.string().optional(),
});

export async function submitRequestAction(prev: any, formData: FormData) {
  try {
    const s = await requireTenant();
    const parsed = SubmitRequestSchema.safeParse({
      type: formData.get("type"),
      employeeId: formData.get("employeeId"),
      branchId: formData.get("branchId") || undefined,
      date: formData.get("date"),
      reason: formData.get("reason"),
      requestedClockIn: formData.get("requestedClockIn") || undefined,
      requestedClockOut: formData.get("requestedClockOut") || undefined,
      dateTo: formData.get("dateTo") || undefined,
      fromTime: formData.get("fromTime") || undefined,
      toTime: formData.get("toTime") || undefined,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const d = parsed.data;

    const employee = await db.employee.findFirst({
      where: { id: d.employeeId, companyId: s.tenantId, deletedAt: null },
    });
    if (!employee) return { ok: false, error: "Employee not found" };

    // Never trust a caller-supplied branch for an employee-scoped request.
    if (d.branchId && d.branchId !== employee.branchId) {
      return { ok: false, error: "Employee does not belong to the selected branch" };
    }

    const isSelf = employee.userId === s.sub;
    const permission = requestPermission(d.type, isSelf ? "self" : "manage");
    const authorization = await evaluatePermission({
      companyId: s.tenantId,
      userId: s.sub,
      legacyRole: s.role,
      permission,
      scope: {
        branchId: employee.branchId,
        departmentId: employee.departmentId,
        targetUserId: employee.userId,
      },
    });
    if (!authorization.allowed) {
      return {
        ok: false,
        error: s.role === "EMPLOYEE" && !isSelf
          ? "You can only submit requests for yourself"
          : "You do not have permission to submit this request",
      };
    }

    const requestedData: any = {};
    if (d.requestedClockIn) requestedData.clockIn = d.requestedClockIn;
    if (d.requestedClockOut) requestedData.clockOut = d.requestedClockOut;
    if (d.dateTo) requestedData.dateTo = d.dateTo;
    if (d.fromTime) requestedData.fromTime = d.fromTime;
    if (d.toTime) requestedData.toTime = d.toTime;

    const req = await db.approvalRequest.create({
      data: {
        companyId: s.tenantId,
        employeeId: d.employeeId,
        branchId: employee.branchId,
        date: new Date(d.date),
        type: d.type,
        reason: d.reason,
        requestedData: Object.keys(requestedData).length > 0 ? JSON.stringify(requestedData) : null,
        status: "PENDING",
        requestedById: s.sub,
      },
    });

    await logTenantEvent({ companyId: s.tenantId, actorId: s.sub, actorEmail: s.email, action: "APPROVAL_SUBMITTED", entityType: "ApprovalRequest", entityId: req.id, reason: d.type });
    revalidatePath("/approvals");
    revalidatePath("/requests");
    return { ok: true };
  } catch (e) {
    console.error("[actions] submitRequestAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

// ─────────────────────────────────────────────
// Approve / Reject
// ─────────────────────────────────────────────

const DecideSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  managerNotes: z.string().optional(),
});

export async function decideRequestAction(prev: any, formData: FormData) {
  try {
    const s = await requireTenant();
    const parsed = DecideSchema.safeParse({
      requestId: formData.get("requestId"),
      decision: formData.get("decision"),
      managerNotes: formData.get("managerNotes") || undefined,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const { requestId, decision, managerNotes } = parsed.data;

    const req = await db.approvalRequest.findFirst({ where: { id: requestId, companyId: s.tenantId } });
    if (!req) return { ok: false, error: "Request not found" };
    if (req.status !== "PENDING") return { ok: false, error: "Request is no longer pending" };

    // Four-eyes rule: nobody may approve or reject their own request.
    if (req.requestedById === s.sub) {
      return { ok: false, error: "You cannot approve or reject your own request" };
    }

    const employee = await db.employee.findFirst({
      where: { id: req.employeeId, companyId: s.tenantId, deletedAt: null },
      select: { id: true, branchId: true, departmentId: true, userId: true },
    });
    if (!employee) return { ok: false, error: "Employee not found" };

    const authorization = await evaluatePermission({
      companyId: s.tenantId,
      userId: s.sub,
      legacyRole: s.role,
      permission: requestPermission(req.type, "approve"),
      scope: {
        branchId: req.branchId ?? employee.branchId,
        departmentId: employee.departmentId,
        targetUserId: employee.userId,
      },
    });
    if (!authorization.allowed) {
      return { ok: false, error: "You do not have permission to approve or reject this request" };
    }

    // During IAM migration, legacy branch-manager fallback must retain the old
    // branch boundary. Provisioned/custom IAM assignments are already scope-
    // checked by evaluatePermission above.
    if (authorization.source === "legacy" && s.role === "BRANCH_MANAGER") {
      const managedBranchIds = await getManagedBranchIds(s.sub, s.tenantId);
      const requestBranchId = req.branchId ?? employee.branchId;
      if (!requestBranchId || !managedBranchIds.includes(requestBranchId)) {
        return { ok: false, error: "You can only approve requests for your branch" };
      }
    }

    await db.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: decision,
        approvedById: decision === "APPROVED" ? s.sub : null,
        approvedAt: decision === "APPROVED" ? new Date() : null,
        rejectedById: decision === "REJECTED" ? s.sub : null,
        rejectedAt: decision === "REJECTED" ? new Date() : null,
        managerNotes: managerNotes ?? null,
      },
    });

    const dayStart = new Date(req.date ?? new Date());
    dayStart.setHours(0, 0, 0, 0);

    // Trust/geofence reviews point to the original Punch. Resolve that Punch on
    // both approval and rejection so it can never remain stuck in
    // NEEDS_APPROVAL after a manager has already made a decision.
    let relatedPunchResolved = false;
    if (req.relatedPunchId) {
      const relatedPunch = await db.punch.findFirst({
        where: {
          id: req.relatedPunchId,
          companyId: s.tenantId,
          employeeId: req.employeeId,
        },
        select: { id: true },
      });
      if (relatedPunch) {
        await db.$transaction([
          db.punch.update({
            where: { id: relatedPunch.id },
            data: { status: decision === "APPROVED" ? "ACCEPTED" : "REJECTED" },
          }),
          db.attendanceTrustAssessment.updateMany({
            where: { companyId: s.tenantId, punchId: relatedPunch.id },
            data: {
              reviewStatus: decision === "APPROVED" ? "APPROVED" : "REJECTED",
              reviewedById: s.sub,
              reviewedAt: new Date(),
              reviewNotes: managerNotes ?? null,
            },
          }),
        ]);
        await recalculateAttendanceDay({ employeeId: req.employeeId, date: dayStart });
        relatedPunchResolved = true;
      }
    }

    if (decision === "APPROVED") {
      if (req.type === "MANUAL_CLOCK_IN") {
        const data = req.requestedData ? JSON.parse(req.requestedData) : {};
        const ts = data.clockIn ? new Date(`${dayStart.toISOString().split("T")[0]}T${data.clockIn}:00`) : new Date();
        await db.punch.create({ data: { companyId: s.tenantId, employeeId: req.employeeId, branchId: req.branchId, type: "CLOCK_IN", timestamp: ts, source: "MANUAL_ADJUSTMENT", status: "ACCEPTED", insideGeofence: true, distanceMeters: 0 } });
        await recalculateAttendanceDay({ employeeId: req.employeeId, date: dayStart });
      } else if (req.type === "MANUAL_CLOCK_OUT" || req.type === "MISSING_CLOCK_OUT") {
        const data = req.requestedData ? JSON.parse(req.requestedData) : {};
        const ts = data.clockOut ? new Date(`${dayStart.toISOString().split("T")[0]}T${data.clockOut}:00`) : new Date();
        await db.punch.create({ data: { companyId: s.tenantId, employeeId: req.employeeId, branchId: req.branchId, type: "CLOCK_OUT", timestamp: ts, source: "MANUAL_ADJUSTMENT", status: "ACCEPTED", insideGeofence: true, distanceMeters: 0 } });
        await recalculateAttendanceDay({ employeeId: req.employeeId, date: dayStart });
      } else if (req.type === "OUTSIDE_GEOFENCE" && !relatedPunchResolved) {
        // Legacy requests may not have a relatedPunchId. Keep their historical
        // behavior without allowing a cross-tenant punch lookup.
        await recalculateAttendanceDay({ employeeId: req.employeeId, date: dayStart });
      } else if (req.type === "LEAVE_REQUEST") {
        const data = req.requestedData ? JSON.parse(req.requestedData) : {};
        const dateTo = data.dateTo ? new Date(data.dateTo) : dayStart;
        for (let dt = new Date(dayStart); dt <= dateTo; dt.setDate(dt.getDate() + 1)) {
          await db.schedule.updateMany({ where: { companyId: s.tenantId, employeeId: req.employeeId, date: new Date(dt) }, data: { status: "LEAVE" } });
          await db.attendanceDay.upsert({
            where: { companyId_employeeId_date: { companyId: s.tenantId, employeeId: req.employeeId, date: new Date(dt) } },
            update: { status: "LEAVE" },
            create: { companyId: s.tenantId, employeeId: req.employeeId, date: new Date(dt), status: "LEAVE" },
          });
        }
      }
    }

    await logTenantEvent({
      companyId: s.tenantId,
      actorId: s.sub,
      actorEmail: s.email,
      action: decision === "APPROVED" ? "APPROVAL_APPROVED" : "APPROVAL_REJECTED",
      entityType: "ApprovalRequest",
      entityId: requestId,
      reason: req.type,
      afterData: req.relatedPunchId ? { relatedPunchId: req.relatedPunchId, punchStatus: decision === "APPROVED" ? "ACCEPTED" : "REJECTED" } : undefined,
    });
    revalidatePath("/approvals");
    revalidatePath(`/approvals/${requestId}`);
    revalidatePath("/live");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    console.error("[actions] decideRequestAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function cancelRequestAction(requestId: string) {
  try {
    const s = await requireTenant();
    const req = await db.approvalRequest.findFirst({ where: { id: requestId, companyId: s.tenantId } });
    if (!req) return { ok: false, error: "Request not found" };
    if (req.status !== "PENDING") return { ok: false, error: "Only pending requests can be cancelled" };

    // The original requester may always withdraw a still-pending request. Any
    // other user needs scoped team-management permission for the subject.
    if (req.requestedById !== s.sub) {
      const employee = await db.employee.findFirst({
        where: { id: req.employeeId, companyId: s.tenantId, deletedAt: null },
        select: { branchId: true, departmentId: true, userId: true },
      });
      if (!employee) return { ok: false, error: "Employee not found" };
      const authorization = await evaluatePermission({
        companyId: s.tenantId,
        userId: s.sub,
        legacyRole: s.role,
        permission: requestPermission(req.type, "manage"),
        scope: {
          branchId: req.branchId ?? employee.branchId,
          departmentId: employee.departmentId,
          targetUserId: employee.userId,
        },
      });
      if (!authorization.allowed) return { ok: false, error: "You do not have permission to cancel this request" };
    }

    await db.approvalRequest.update({ where: { id: requestId }, data: { status: "CANCELLED" } });
    await logTenantEvent({ companyId: s.tenantId, actorId: s.sub, actorEmail: s.email, action: "APPROVAL_REJECTED", entityType: "ApprovalRequest", entityId: requestId, reason: "Cancelled by user" });
    revalidatePath("/approvals");
    revalidatePath("/requests");
    return { ok: true };
  } catch (e) {
    console.error("[actions] cancelRequestAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}
