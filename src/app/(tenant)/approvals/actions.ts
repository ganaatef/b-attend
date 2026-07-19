"use server";

/**
 * B-Attend approvals Server Actions — Phase 5.
 *
 * Employee submits request → manager/HR approves/rejects → side effects on AttendanceDay.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logTenantEvent } from "@/lib/auth/audit";
import { recalculateAttendanceDay } from "@/lib/attendance/engine";

async function requireTenant() {
  const s = await getSession();
  if (!s || s.kind !== "tenant" || !s.tenantId) throw new Error("FORBIDDEN");
  return s;
}

// ─────────────────────────────────────────────
// Submit request (employee)
// ─────────────────────────────────────────────

const SubmitRequestSchema = z.object({
  type: z.enum(["MANUAL_CLOCK_IN", "MANUAL_CLOCK_OUT", "OUTSIDE_GEOFENCE", "MISSING_CLOCK_OUT", "OVERTIME", "ATTENDANCE_ADJUSTMENT", "LEAVE_REQUEST", "PERMISSION_REQUEST"]),
  employeeId: z.string().min(1),
  branchId: z.string().optional(),
  date: z.string().min(1),
  reason: z.string().min(5, "Provide a clear reason (at least 5 characters)"),
  // Optional fields per type
  requestedClockIn: z.string().optional(),
  requestedClockOut: z.string().optional(),
  dateTo: z.string().optional(), // for leave range
  fromTime: z.string().optional(), // for permission
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

    // Verify employee belongs to tenant
    const employee = await db.employee.findFirst({ where: { id: d.employeeId, companyId: s.tenantId! } });
    if (!employee) return { ok: false, error: "Employee not found" };

    // Employees can only submit for themselves
    if (s.role === "EMPLOYEE" && employee.userId !== s.sub) {
      return { ok: false, error: "You can only submit requests for yourself" };
    }

    const requestedData: any = {};
    if (d.requestedClockIn) requestedData.clockIn = d.requestedClockIn;
    if (d.requestedClockOut) requestedData.clockOut = d.requestedClockOut;
    if (d.dateTo) requestedData.dateTo = d.dateTo;
    if (d.fromTime) requestedData.fromTime = d.fromTime;
    if (d.toTime) requestedData.toTime = d.toTime;

    const req = await db.approvalRequest.create({
      data: {
        companyId: s.tenantId!,
        employeeId: d.employeeId,
        branchId: d.branchId ?? employee.branchId,
        date: new Date(d.date),
        type: d.type,
        reason: d.reason,
        requestedData: Object.keys(requestedData).length > 0 ? JSON.stringify(requestedData) : null,
        status: "PENDING",
        requestedById: s.sub,
      },
    });

    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "APPROVAL_SUBMITTED", entityType: "ApprovalRequest", entityId: req.id, reason: d.type });
    revalidatePath("/approvals");
    revalidatePath("/requests");
    return { ok: true };
  } catch (e) {
    console.error("[actions] submitRequestAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

// ─────────────────────────────────────────────
// Approve / Reject (manager / HR / owner)
// ─────────────────────────────────────────────

const DecideSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  managerNotes: z.string().optional(),
});

export async function decideRequestAction(prev: any, formData: FormData) {
  try {
    const s = await requireTenant();
    if (s.role !== "COMPANY_OWNER" && s.role !== "HR_ADMIN" && s.role !== "BRANCH_MANAGER") {
      return { ok: false, error: "Only managers can approve/reject requests" };
    }
    const parsed = DecideSchema.safeParse({
      requestId: formData.get("requestId"),
      decision: formData.get("decision"),
      managerNotes: formData.get("managerNotes") || undefined,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const { requestId, decision, managerNotes } = parsed.data;

    const req = await db.approvalRequest.findFirst({ where: { id: requestId, companyId: s.tenantId! } });
    if (!req) return { ok: false, error: "Request not found" };
    if (req.status !== "PENDING") return { ok: false, error: "Request is no longer pending" };

    // Branch managers can only decide on their branch
    if (s.role === "BRANCH_MANAGER") {
      const user = await db.user.findUnique({ where: { id: s.sub } });
      const managed = await db.branch.findMany({ where: { companyId: s.tenantId!, managerId: user?.id } });
      if (!managed.some((b) => b.id === req.branchId)) {
        return { ok: false, error: "You can only approve requests for your branch" };
      }
    }

    // Update request
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

    // Side effects on approval
    if (decision === "APPROVED") {
      const dayStart = new Date(req.date!); dayStart.setHours(0, 0, 0, 0);
      if (req.type === "MANUAL_CLOCK_IN") {
        const data = req.requestedData ? JSON.parse(req.requestedData) : {};
        const ts = data.clockIn ? new Date(`${dayStart.toISOString().split("T")[0]}T${data.clockIn}:00`) : new Date();
        await db.punch.create({ data: { companyId: s.tenantId!, employeeId: req.employeeId, branchId: req.branchId, type: "CLOCK_IN", timestamp: ts, source: "MANUAL_ADJUSTMENT", status: "ACCEPTED", insideGeofence: true, distanceMeters: 0 } });
        await recalculateAttendanceDay({ employeeId: req.employeeId, date: dayStart });
      } else if (req.type === "MANUAL_CLOCK_OUT" || req.type === "MISSING_CLOCK_OUT") {
        const data = req.requestedData ? JSON.parse(req.requestedData) : {};
        const ts = data.clockOut ? new Date(`${dayStart.toISOString().split("T")[0]}T${data.clockOut}:00`) : new Date();
        await db.punch.create({ data: { companyId: s.tenantId!, employeeId: req.employeeId, branchId: req.branchId, type: "CLOCK_OUT", timestamp: ts, source: "MANUAL_ADJUSTMENT", status: "ACCEPTED", insideGeofence: true, distanceMeters: 0 } });
        await recalculateAttendanceDay({ employeeId: req.employeeId, date: dayStart });
      } else if (req.type === "OUTSIDE_GEOFENCE") {
        if (req.relatedPunchId) {
          await db.punch.update({ where: { id: req.relatedPunchId }, data: { status: "ACCEPTED" } });
        }
        await recalculateAttendanceDay({ employeeId: req.employeeId, date: dayStart });
      } else if (req.type === "LEAVE_REQUEST") {
        const data = req.requestedData ? JSON.parse(req.requestedData) : {};
        const dateTo = data.dateTo ? new Date(data.dateTo) : dayStart;
        for (let dt = new Date(dayStart); dt <= dateTo; dt.setDate(dt.getDate() + 1)) {
          await db.schedule.updateMany({ where: { companyId: s.tenantId!, employeeId: req.employeeId, date: new Date(dt) }, data: { status: "LEAVE" } });
          await db.attendanceDay.upsert({
            where: { companyId_employeeId_date: { companyId: s.tenantId!, employeeId: req.employeeId, date: new Date(dt) } },
            update: { status: "LEAVE" },
            create: { companyId: s.tenantId!, employeeId: req.employeeId, date: new Date(dt), status: "LEAVE" },
          });
        }
      }
    }

    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: decision === "APPROVED" ? "APPROVAL_APPROVED" : "APPROVAL_REJECTED", entityType: "ApprovalRequest", entityId: requestId, reason: req.type });
    revalidatePath("/approvals");
    revalidatePath(`/approvals/${requestId}`);
    return { ok: true };
  } catch (e) {
    console.error("[actions] decideRequestAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function cancelRequestAction(requestId: string) {
  try {
    const s = await requireTenant();
    const req = await db.approvalRequest.findFirst({ where: { id: requestId, companyId: s.tenantId! } });
    if (!req) return { ok: false, error: "Request not found" };
    if (req.requestedById !== s.sub && s.role !== "COMPANY_OWNER" && s.role !== "HR_ADMIN") {
      return { ok: false, error: "You can only cancel your own requests" };
    }
    await db.approvalRequest.update({ where: { id: requestId }, data: { status: "CANCELLED" } });
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "APPROVAL_REJECTED", entityType: "ApprovalRequest", entityId: requestId, reason: "Cancelled by user" });
    revalidatePath("/approvals");
    revalidatePath("/requests");
    return { ok: true };
  } catch (e) {
    console.error("[actions] cancelRequestAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}
