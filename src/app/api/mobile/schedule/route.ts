import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMobileEmployee } from "@/lib/auth/mobile";

const DateSchema = z.string().date();

function startOfDay(value: Date) {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day;
}

export async function GET(request: NextRequest) {
  const context = await requireMobileEmployee(request);
  if (!context) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const fromInput = request.nextUrl.searchParams.get("from");
  const toInput = request.nextUrl.searchParams.get("to");
  const from = fromInput ? DateSchema.safeParse(fromInput) : null;
  const to = toInput ? DateSchema.safeParse(toInput) : null;
  if ((from && !from.success) || (to && !to.success)) {
    return NextResponse.json({ error: "INVALID_DATE_RANGE" }, { status: 400 });
  }

  const rangeStart = startOfDay(from?.data ? new Date(`${from.data}T00:00:00`) : new Date());
  const rangeEnd = startOfDay(to?.data ? new Date(`${to.data}T00:00:00`) : new Date(rangeStart));
  if (!to?.data) rangeEnd.setDate(rangeStart.getDate() + 14);
  if (rangeEnd < rangeStart || rangeEnd.getTime() - rangeStart.getTime() > 31 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "INVALID_DATE_RANGE" }, { status: 400 });
  }
  rangeEnd.setDate(rangeEnd.getDate() + 1);

  const schedules = await db.schedule.findMany({
    where: {
      companyId: context.employee.companyId,
      employeeId: context.employee.id,
      date: { gte: rangeStart, lt: rangeEnd },
    },
    orderBy: { date: "asc" },
    include: {
      branch: { select: { id: true, name: true } },
      shiftPolicy: { select: { name: true } },
    },
  });

  return NextResponse.json({
    schedules: schedules.map((schedule) => ({
      id: schedule.id,
      date: schedule.date,
      expectedStart: schedule.expectedStart,
      expectedEnd: schedule.expectedEnd,
      status: schedule.status,
      notes: schedule.notes,
      branch: schedule.branch,
      shiftName: schedule.shiftPolicy?.name ?? null,
    })),
  });
}
