/**
 * PIN Migration Script — Backfill pinHash from plaintext pinCode.
 *
 * Run against the target database:
 *   npx tsx scripts/migrate-pin-hashes.ts
 *
 * This script:
 *   1. Counts employees with plaintext pinCode
 *   2. Counts employees with existing pinHash
 *   3. Hashes each plaintext pinCode using SHA-256 (matching kiosk lookup)
 *   4. Updates pinHash field
 *   5. Reports results
 *
 * Idempotent: skips employees that already have pinHash populated.
 * Safe: does NOT delete or modify pinCode (kept for backward compat until Phase 5).
 */

import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function main() {
  console.log("=== PIN Migration: pinCode → pinHash ===\n");

  // 1. Count plaintext pinCode values
  const withPinCode = await db.employee.count({
    where: { pinCode: { not: null }, deletedAt: null },
  });
  console.log(`Employees with plaintext pinCode: ${withPinCode}`);

  // 2. Count existing pinHash values
  const withPinHash = await db.employee.count({
    where: { pinHash: { not: null }, deletedAt: null },
  });
  console.log(`Employees with existing pinHash:  ${withPinHash}`);

  // 3. Find employees that need migration (have pinCode but no pinHash)
  const needsMigration = await db.employee.findMany({
    where: {
      pinCode: { not: null },
      pinHash: null,
      deletedAt: null,
    },
    select: { id: true, employeeCode: true, pinCode: true },
  });
  console.log(`Employees needing migration:       ${needsMigration.length}\n`);

  if (needsMigration.length === 0) {
    console.log("Nothing to migrate. All done.");
    return;
  }

  // 4. Backfill pinHash
  let migrated = 0;
  let failed = 0;

  for (const emp of needsMigration) {
    try {
      const hash = sha256(emp.pinCode!);
      await db.employee.update({
        where: { id: emp.id },
        data: { pinHash: hash },
      });
      migrated++;
      console.log(`  ✓ ${emp.employeeCode} — pinHash set (${hash.slice(0, 12)}...)`);
    } catch (e) {
      failed++;
      console.error(`  ✗ ${emp.employeeCode} — FAILED: ${e}`);
    }
  }

  console.log(`\n=== Migration complete ===`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Failed:   ${failed}`);

  // 5. Verify final state
  const finalPinHash = await db.employee.count({
    where: { pinHash: { not: null }, deletedAt: null },
  });
  console.log(`  Total with pinHash: ${finalPinHash}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
