/**
 * PIN Migration Script — Backfill Employee.pinHash from plaintext Employee.pinCode.
 *
 * Run against the target database (e.g. the Vercel Preview branch):
 *   npx tsx scripts/migrate-pin-hashes.ts            # real run
 *   npx tsx scripts/migrate-pin-hashes.ts --dry-run  # report only, no writes
 *
 * Per-employee behavior (each migration runs inside an interactive transaction):
 *   - pinHash already set                 -> skipped as already migrated (no rehash)
 *   - pinCode present, pinHash missing    -> bcrypt(pinCode, cost 10) -> write pinHash
 *                                            -> verify the write with a fresh read
 *                                            -> only then clear the plaintext pinCode
 *   - neither present                     -> nothing to do
 *
 * Transactional safety: the hash write + verification + plaintext clear commit
 * together (or roll back together), so the script never ends with no usable
 * credential — if anything fails, the plaintext PIN is preserved.
 *
 * Never logs a raw PIN value. Idempotent — safe to re-run.
 * After a successful run the report ends with:
 *   remaining plaintext PINs: 0
 *
 * NOTE: This script is the ONLY allowed reference to pinCode for writes. All
 * active application authentication paths read Employee.pinHash only.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

interface Counts {
  inspected: number;
  legacyFound: number;
  alreadyMigrated: number;
  hashesCreated: number;
  cleared: number;
  failed: number;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log(`=== PIN Migration: pinCode → pinHash${dryRun ? " (DRY RUN — no writes)" : ""} ===\n`);

  const counts: Counts = { inspected: 0, legacyFound: 0, alreadyMigrated: 0, hashesCreated: 0, cleared: 0, failed: 0 };

  const employees = await db.employee.findMany({
    where: { deletedAt: null },
    select: { id: true, employeeCode: true, pinCode: true, pinHash: true },
    orderBy: { employeeCode: "asc" },
  });

  counts.inspected = employees.length;
  counts.legacyFound = employees.filter((e) => e.pinCode != null).length;
  counts.alreadyMigrated = employees.filter((e) => e.pinHash != null).length;

  for (const emp of employees) {
    // Fully migrated already (hash present, no plaintext) — nothing to do.
    if (emp.pinCode == null && emp.pinHash != null) continue;
    // No PIN at all — nothing to do.
    if (emp.pinCode == null) continue;

    try {
      // Create a hash only when pinHash is missing. Employees that already have
      // pinHash are never rehashed — only their leftover plaintext is cleared.
      if (emp.pinHash == null) {
        const hash = await bcrypt.hash(emp.pinCode, 10);
        if (dryRun) {
          counts.hashesCreated++;
        } else {
          await db.$transaction(async (tx) => {
            await tx.employee.update({ where: { id: emp.id }, data: { pinHash: hash } });
            const after = await tx.employee.findUnique({
              where: { id: emp.id },
              select: { pinHash: true },
            });
            if (after?.pinHash !== hash) {
              throw new Error("pinHash verification failed after update");
            }
            await tx.employee.update({ where: { id: emp.id }, data: { pinCode: null } });
          });
          counts.hashesCreated++;
          counts.cleared++;
        }
      } else {
        // pinHash already exists; clear the leftover plaintext PIN.
        if (dryRun) {
          counts.cleared++;
        } else {
          await db.employee.update({ where: { id: emp.id }, data: { pinCode: null } });
          counts.cleared++;
        }
      }
    } catch {
      counts.failed++;
      console.error(`  ✗ ${emp.employeeCode} — migration failed (raw PIN is never logged)`);
    }
  }

  const remaining = await db.employee.count({
    where: { pinCode: { not: null }, deletedAt: null },
  });

  console.log("\n=== PIN Migration Summary ===");
  console.log(`employees inspected:         ${counts.inspected}`);
  console.log(`legacy plaintext PINs found: ${counts.legacyFound}`);
  console.log(`hashes created:              ${counts.hashesCreated}`);
  console.log(`already migrated:            ${counts.alreadyMigrated}`);
  console.log(`plaintext PINs cleared:      ${counts.cleared}`);
  console.log(`failed:                      ${counts.failed}`);
  console.log(`remaining plaintext PINs:    ${remaining}${dryRun ? " (dry run — not applied)" : ""}`);

  if (!dryRun && remaining > 0) {
    console.error(`\n⚠️  Acceptance not met: remaining plaintext PINs should be 0. Re-run to retry.`);
    await db.$disconnect();
    process.exit(1);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
