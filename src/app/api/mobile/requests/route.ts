import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMobileEmployee } from "@/lib/auth/mobile";
import { canUseHrFeature } from "@/lib/hr/feature-gates";

const CreateLeaveRequestSchema = z.object({
  leaveTypeId: z.string().min(1),
  startDate: z.string().date(),
  endDate: z.string().date(),
  reason: z.string().trim().max(500).optional(),
});

export async function GET(request: NextRequest) {
  const context = await requireMobileEmployee(request);
  if (!context) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const currentYear = new Date().getFullYear();
  const [balances, leaveRequests] = await Promise.all([
    db.leaveBalance.findMany({
      where: { employeeId: context.employee.id, year: currentYear },
      include: { leaveType: { select: { id: true, name: true, code: true } } },
      orderBy: { leaveType: { name: "asc" } },
    }),
    db.leaveRequest.findMany({
      where: { companyId: context.employee.companyId, employeeId: context.employee.id },
      include: { leaveType: { select: { id: true, name: true, code: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  const leaveTypes = await db.leaveType.findMany({
    where: { companyId: context.employee.companyId, active: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    leaveTypes,
    balances: balances.map((balance) => ({
      id: balance.id,
      leaveType: balance.leaveType,
      year: balance.year,
      remaining: balance.remaining,
      used: balance.used,
      pending: balance.pending,
      total: balance.openingBalance + balance.accrued,
    })),
    requests: leaveRequests.map((leave) => ({
      id: leave.id,
      leaveType: leave.leaveType,
      startDate: leave.startDate,
      endDate: leave.endDate,
      daysCount: leave.daysCount,
      status: leave.status,
      reason: leave.reason,
      createdAt: leave.createdAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const context = await requireMobileEmployee(request);
  if (!context) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const feature = await canUseHrFeature(context.employee.companyId, "hr_leave");
  if (!feature.allowed) return NextResponse.json({ error: "LEAVE_FEATURE_UNAVAILABLE" }, { status: 403 });

  const parsed = CreateLeaveRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_LEAVE_REQUEST" }, { status: 400 });
  const startDate = new Date(`${parsed.data.startDate}T00:00:00`);
  const endDate = new Date(`${parsed.data.endDate}T00:00:00`);
  const daysCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (daysCount < 1) return NextResponse.json({ error: "INVALID_DATE_RANGE" }, { status: 400 });

  const leaveType = await db.leaveType.findFirst({
    where: { id: parsed.data.leaveTypeId, companyId: context.employee.companyId, active: true },
  });
  if (!leaveType) return NextResponse.json({ error: "LEAVE_TYPE_NOT_FOUND" }, { status: 404 });

  const leaveRequest = await db.$transaction(async (tx) => {
    const created = await tx.leaveRequest.create({
      data: {
        companyId: context.employee.companyId,
        employeeId: context.employee.id,
        leaveTypeId: leaveType.id,
        startDate,
        endDate,
        daysCount,
        reason: parsed.data.reason || null,
        status: leaveType.requiresApproval ? "PENDING" : "APPROVED",
        requestedById: context.user.id,
      },
      include: { leaveType: { select: { id: true, name: true, code: true } } },
    });
    await tx.leaveBalance.updateMany({
      where: { employeeId: context.employee.id, leaveTypeId: leaveType.id, year: startDate.getFullYear(), companyId: context.employee.companyId },
      data: leaveType.requiresApproval
        ? { pending: { increment: daysCount } }
        : { pending: { decrement: daysCount }, used: { increment: daysCount }, remaining: { decrement: daysCount } },
    });
    await tx.auditLog.create({
      data: {
        companyId: context.employee.companyId,
        actorId: context.user.id,
        actorEmail: context.user.email,
        action: "LEAVE_REQUEST_CREATED",
        entityType: "LeaveRequest",
        entityId: created.id,
        reason: `${daysCount} days ${leaveType.name} (B-Attend Staff)`,
      },
    });
    return created;
  });

  return NextResponse.json({
    id: leaveRequest.id,
    leaveType: leaveRequest.leaveType,
    startDate: leaveRequest.startDate,
    endDate: leaveRequest.endDate,
    daysCount: leaveRequest.daysCount,
    status: leaveRequest.status,
    reason: leaveRequest.reason,
    createdAt: leaveRequest.createdAt,
  }, { status: 201 });
}
