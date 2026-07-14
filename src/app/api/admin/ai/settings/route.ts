/**
 * GET/POST /api/admin/ai/settings — Super Admin AI settings.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logPlatformEvent } from "@/lib/auth/audit";

export async function GET() {
  const session = await getSession();
  if (!session || session.kind !== "platform" || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await db.systemSetting.findFirst({ where: { isMain: true } });
  return NextResponse.json({ ok: true, settings });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.kind !== "platform" || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const update: any = {};
  if (typeof body.aiModuleEnabled === "boolean") update.aiModuleEnabled = body.aiModuleEnabled;
  if (typeof body.aiProvider === "string") update.aiProvider = body.aiProvider;
  if (typeof body.aiDailyCoachEnabled === "boolean") update.aiDailyCoachEnabled = body.aiDailyCoachEnabled;
  if (typeof body.aiEmployeeInsightsEnabled === "boolean") update.aiEmployeeInsightsEnabled = body.aiEmployeeInsightsEnabled;
  if (typeof body.aiManagerInsightsEnabled === "boolean") update.aiManagerInsightsEnabled = body.aiManagerInsightsEnabled;
  if (typeof body.allowOpenaiProvider === "boolean") update.allowOpenaiProvider = body.allowOpenaiProvider;
  if (typeof body.mockProviderEnabled === "boolean") update.mockProviderEnabled = body.mockProviderEnabled;
  if (typeof body.maxAiGenerationsPerTenantPerMonth === "number") update.maxAiGenerationsPerTenantPerMonth = body.maxAiGenerationsPerTenantPerMonth;
  if (typeof body.aiDefaultLanguage === "string") update.aiDefaultLanguage = body.aiDefaultLanguage;
  if (typeof body.aiPrivacyModeEnabled === "boolean") update.aiPrivacyModeEnabled = body.aiPrivacyModeEnabled;
  await db.systemSetting.update({ where: { isMain: true }, data: update });
  await logPlatformEvent({ actorId: session.sub, actorEmail: session.email, action: "AI_SETTINGS_UPDATED", entityType: "SystemSetting", entityId: "main", afterData: update });
  return NextResponse.json({ ok: true });
}
