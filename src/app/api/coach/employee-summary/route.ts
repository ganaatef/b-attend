/**
 * GET /api/coach/employee-summary?employeeId=...&from=...&to=...
 *
 * Returns the AI-generated coach summary for the employee.
 * Tenant scoping enforced. Employee can only query their own.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { generateEmployeeCoachSnapshot, type DateRange } from "@/lib/ai/coach-engine";
import { canUseAiFeature } from "@/lib/ai/feature-gates";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.kind !== "tenant" || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const employeeId = url.searchParams.get("employeeId");
    if (!employeeId) return NextResponse.json({ error: "employeeId is required" }, { status: 400 });

    // Verify employee belongs to tenant
    const employee = await db.employee.findFirst({ where: { id: employeeId, companyId: session.tenantId } });
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    // Employee self-only check
    if (session.role === "EMPLOYEE") {
      const user = await db.user.findUnique({ where: { id: session.sub } });
      if (user?.employeeId !== employeeId && employee.userId !== session.sub) {
        return NextResponse.json({ error: "Forbidden — you can only view your own coach summary" }, { status: 403 });
      }
    }

    // Feature gate
    const gate = await canUseAiFeature(session.tenantId, "ai_coach");
    if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: 403 });

    // Date range
    const today = new Date();
    const from = url.searchParams.get("from") ?? new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
    const to = url.searchParams.get("to") ?? today.toISOString().split("T")[0];
    const range: DateRange = { start: new Date(from), end: new Date(to) };

    const result = await generateEmployeeCoachSnapshot(employeeId, range, { companyId: session.tenantId, userId: session.sub });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
