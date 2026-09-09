import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * /api/health — deployment monitoring endpoint.
 *
 * - 200 when the application process and database are reachable.
 * - 503 when the database dependency is unavailable.
 * - Never exposes connection strings, versions, or stack traces.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
