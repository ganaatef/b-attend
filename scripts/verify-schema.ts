/**
 * Schema Verification Queries — Run against preview/production database.
 *
 * Usage:
 *   npx tsx scripts/verify-schema.ts
 *
 * Checks:
 *   1. New tables exist (PasswordResetToken, PlatformPasswordResetToken, KioskDevice)
 *   2. New columns exist (failedLoginAttempts, lockedUntil, lastPasswordChangeAt, pinHash)
 *   3. New enum exists (KioskDeviceStatus)
 *   4. Indexes exist
 *   5. Foreign keys exist
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function queryRaw(label: string, sql: string): Promise<any[]> {
  try {
    const result = await db.$queryRawUnsafe(sql);
    return result as any[];
  } catch (e: any) {
    console.error(`  ✗ ${label}: ${e.message}`);
    return [];
  }
}

async function main() {
  console.log("=== Schema Verification ===\n");

  // 1. Check new tables exist
  console.log("── New Tables ──");
  const tables = await queryRaw(
    "tables",
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
  );
  const tableNames = tables.map((t: any) => t.table_name);

  for (const name of ["PasswordResetToken", "PlatformPasswordResetToken", "KioskDevice"]) {
    console.log(`  ${tableNames.includes(name) ? "✓" : "✗"} ${name}`);
  }

  // 2. Check new enum exists
  console.log("\n── New Enums ──");
  const enums = await queryRaw(
    "enums",
    `SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname`
  );
  const enumNames = enums.map((e: any) => e.typname);
  console.log(`  ${enumNames.includes("KioskDeviceStatus") ? "✓" : "✗"} KioskDeviceStatus`);

  // 3. Check new columns on PlatformUser
  console.log("\n── PlatformUser Columns ──");
  const puCols = await queryRaw(
    "pu columns",
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'PlatformUser' ORDER BY ordinal_position`
  );
  const puColNames = puCols.map((c: any) => c.column_name);
  for (const col of ["failedLoginAttempts", "lockedUntil", "lastPasswordChangeAt"]) {
    console.log(`  ${puColNames.includes(col) ? "✓" : "✗"} ${col}`);
  }

  // 4. Check new columns on User
  console.log("\n── User Columns ──");
  const userCols = await queryRaw(
    "user columns",
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'User' ORDER BY ordinal_position`
  );
  const userColNames = userCols.map((c: any) => c.column_name);
  for (const col of ["failedLoginAttempts", "lockedUntil", "lastPasswordChangeAt"]) {
    console.log(`  ${userColNames.includes(col) ? "✓" : "✗"} ${col}`);
  }

  // 5. Check new column on Employee
  console.log("\n── Employee Columns ──");
  const empCols = await queryRaw(
    "emp columns",
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'Employee' ORDER BY ordinal_position`
  );
  const empColNames = empCols.map((c: any) => c.column_name);
  console.log(`  ${empColNames.includes("pinHash") ? "✓" : "✗"} pinHash`);

  // 6. Check indexes on new tables
  console.log("\n── Indexes ──");
  const indexes = await queryRaw(
    "indexes",
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE '%PasswordReset%' OR indexname LIKE '%KioskDevice%' ORDER BY indexname`
  );
  for (const idx of indexes) {
    console.log(`  ✓ ${idx.indexname}`);
  }
  if (indexes.length === 0) {
    console.log("  ✗ No new indexes found");
  }

  // 7. Check foreign keys on new tables
  console.log("\n── Foreign Keys ──");
  const fks = await queryRaw(
    "fks",
    `SELECT tc.constraint_name, tc.table_name, kcu.column_name, ccu.table_name AS foreign_table
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
     JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN ('PasswordResetToken', 'PlatformPasswordResetToken', 'KioskDevice')
     ORDER BY tc.table_name`
  );
  for (const fk of fks) {
    console.log(`  ✓ ${fk.table_name}.${fk.column_name} → ${fk.foreign_table}`);
  }
  if (fks.length === 0) {
    console.log("  ✗ No foreign keys found on new tables");
  }

  // 8. PIN migration status
  console.log("\n── PIN Migration Status ──");
  const pinStats = await queryRaw(
    "pin stats",
    `SELECT
       COUNT(*) FILTER (WHERE "pinCode" IS NOT NULL AND "deletedAt" IS NULL) AS "withPinCode",
       COUNT(*) FILTER (WHERE "pinHash" IS NOT NULL AND "deletedAt" IS NULL) AS "withPinHash",
       COUNT(*) FILTER (WHERE "pinCode" IS NOT NULL AND "pinHash" IS NULL AND "deletedAt" IS NULL) AS "needsMigration"
     FROM "Employee"`
  );
  if (pinStats.length > 0) {
    const s = pinStats[0];
    console.log(`  With pinCode (plaintext): ${s.withPinCode}`);
    console.log(`  With pinHash (hashed):    ${s.withPinHash}`);
    console.log(`  Needs migration:          ${s.needsMigration}`);
  }

  console.log("\n=== Verification complete ===");
  await db.$disconnect();
}

main().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});
