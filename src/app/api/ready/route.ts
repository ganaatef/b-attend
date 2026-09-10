import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Keep this aligned with the newest migration required by the running release.
// Readiness intentionally returns no migration names or database metadata.
const REQUIRED_MIGRATION = "20260910010000_enterprise_iam_foundation";

type MigrationState = {
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

type PendingCount = { count: number };

/**
 * /api/ready — release/readiness probe.
 *
 * Unlike /api/health (basic liveness + DB reachability), readiness verifies that
 * the database has the minimum migration required by this application build and
 * that no unresolved Prisma migration is left mid-flight. It never returns
 * schema names, versions, connection metadata or stack traces.
 */
export async function GET() {
  try {
    const required = await db.$queryRaw<MigrationState[]>`
      SELECT "finished_at", "rolled_back_at"
      FROM "_prisma_migrations"
      WHERE "migration_name" = ${REQUIRED_MIGRATION}
      LIMIT 1
    `;

    const migration = required[0];
    if (!migration?.finished_at || migration.rolled_back_at) {
      return NextResponse.json({ status: "unavailable" }, { status: 503 });
    }

    const pending = await db.$queryRaw<PendingCount[]>`
      SELECT COUNT(*)::int AS "count"
      FROM "_prisma_migrations"
      WHERE "finished_at" IS NULL AND "rolled_back_at" IS NULL
    `;

    if ((pending[0]?.count ?? 1) > 0) {
      return NextResponse.json({ status: "unavailable" }, { status: 503 });
    }

    return NextResponse.json({ status: "ready" });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
