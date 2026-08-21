import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireMobileEmployee } from "@/lib/auth/mobile";

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

  return NextResponse.json({
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
