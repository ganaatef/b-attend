/**
 * POST /api/system/mark-absent — runs markAbsentForPastScheduledDays.
 * Super Admin can pass ?companyId=...; tenant admins auto-scope to their company.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { markAbsentForPastScheduledDays } from "@/lib/attendance/engine";
import { db } from "@/lib/db";
import { logPlatformEvent, logTenantEvent } from "@/lib/auth/audit";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const daysBack = Math.min(Math.max(Number(body.daysBack ?? 1), 1), 90);

  if (session.kind === "platform") {
    const result = await markAbsentForPastScheduledDays({ companyId: body.companyId, daysBack });
    await logPlatformEvent({
      actorId: session.sub,
      actorEmail: session.email,
      action: "ATTENDANCE_RECALCULATED",
      reason: `mark-absent daysBack=${daysBack} companyId=${body.companyId ?? "ALL"} marked=${result.marked}`,
    });
    return NextResponse.json({ ok: true, ...result });
  }

  if (session.kind === "tenant" && session.tenantId) {
    const user = await db.user.findUnique({ where: { id: session.sub } });
    if (user?.role !== "COMPANY_OWNER" && user?.role !== "HR_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const result = await markAbsentForPastScheduledDays({ companyId: session.tenantId, daysBack });
    await logTenantEvent({
      companyId: session.tenantId,
      actorId: session.sub,
      actorEmail: session.email,
      action: "ATTENDANCE_RECALCULATED",
      reason: `mark-absent daysBack=${daysBack} marked=${result.marked}`,
    });
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
