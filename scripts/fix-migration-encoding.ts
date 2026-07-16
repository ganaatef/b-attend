#!/usr/bin/env node

/**
 * fix-migration-encoding.ts
 *
 * Removes UTF-8 BOM, zero-width/invisible leading characters, and escaped BOM
 * markers from Prisma migration.sql files. Safe, idempotent, and cross-platform.
 *
 * Usage:
 *   npx tsx scripts/fix-migration-encoding.ts [migration.sql path]
 *
 * If no path is given, processes all migration.sql files under prisma/migrations/.
 */

import fs from "fs";
import path from "path";

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

const VALID_SQL_STARTS = ["-- CreateSchema", "-- CreateEnum", "-- CreateTable", "-- CreateIndex", "-- AddForeignKey", "-- AlterTable", "-- AlterEnum"];

function fixMigrationFile(filePath: string): { fixed: boolean; before: string; after: string } {
  const buf = fs.readFileSync(filePath);
  const beforeHex = Array.from(buf.slice(0, 10))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");

  let text = buf.toString("utf8");

  // Remove UTF-8 BOM character
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.substring(1);
  }

  // Remove leading invisible/zero-width characters
  text = text.replace(/^[\u200B\u200C\u200D\uFEFF\u00A0]+/, "");

  // Remove escaped BOM markers like \uFEFF or \ufeff at the start
  text = text.replace(/^(\\u[fF][eE][fF][fF]\s*)+/, "");

  const afterBuf = Buffer.from(text, "utf8");
  const afterHex = Array.from(afterBuf.slice(0, 10))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");

  const changed = !buf.equals(afterBuf);

  if (changed) {
    // Write as UTF-8 without BOM
    fs.writeFileSync(filePath, text, "utf8");
  }

  // Validate that file starts with valid SQL
  const trimmed = text.trimStart();
  const startsCorrectly = VALID_SQL_STARTS.some((s) => trimmed.startsWith(s));
  if (!startsCorrectly) {
    console.warn(`  WARNING: ${filePath} does not start with a known SQL pattern`);
    console.warn(`  First line: ${trimmed.split("\n")[0]}`);
  }

  return { fixed: changed, before: beforeHex, after: afterHex };
}

function main() {
  const targetPath = process.argv[2];

  if (targetPath) {
    const resolved = path.resolve(targetPath);
    if (!fs.existsSync(resolved)) {
      console.error(`File not found: ${resolved}`);
      process.exit(1);
    }
    const result = fixMigrationFile(resolved);
    console.log(`${resolved}`);
    console.log(`  Before: ${result.before}`);
    console.log(`  After:  ${result.after}`);
    console.log(`  Fixed:  ${result.fixed}`);
  } else {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      console.error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
      process.exit(1);
    }

    const migrations = fs.readdirSync(MIGRATIONS_DIR).filter((d) => {
      const lockPath = path.join(MIGRATIONS_DIR, "migration_lock.toml");
      return d !== "migration_lock.toml" && fs.statSync(path.join(MIGRATIONS_DIR, d)).isDirectory();
    });

    let fixedCount = 0;
    for (const migration of migrations) {
      const sqlPath = path.join(MIGRATIONS_DIR, migration, "migration.sql");
      if (!fs.existsSync(sqlPath)) {
        console.log(`${migration}: no migration.sql found, skipping`);
        continue;
      }
      const result = fixMigrationFile(sqlPath);
      if (result.fixed) {
        fixedCount++;
        console.log(`${migration}: FIXED (before: ${result.before} -> after: ${result.after})`);
      } else {
        console.log(`${migration}: OK (no changes needed, first bytes: ${result.after})`);
      }
    }

    console.log(`\nProcessed ${migrations.length} migration(s), fixed ${fixedCount}`);
  }
}

main();
