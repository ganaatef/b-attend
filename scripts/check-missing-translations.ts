/**
 * i18n parity checker — compare Arabic and English translation files
 * AND scan TSX/TS source files for t() calls referencing missing keys.
 * Run: npx tsx scripts/check-missing-translations.ts
 * Or: npm run i18n:check
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, join, relative } from "path";

const enPath = resolve("messages/en.json");
const arPath = resolve("messages/ar.json");

const enRaw = readFileSync(enPath, "utf-8");
const arRaw = readFileSync(arPath, "utf-8");

const en = JSON.parse(enRaw);
const ar = JSON.parse(arRaw);

function flatten(obj: Record<string, any>, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(result, flatten(value, fullKey));
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}

const enFlat = flatten(en);
const arFlat = flatten(ar);

const enKeys = new Set(Object.keys(enFlat));
const arKeys = new Set(Object.keys(arFlat));

let parityFailed = false;
let missingInAr = 0;
let missingInEn = 0;
const arMissingList: string[] = [];
const enMissingList: string[] = [];

for (const key of enKeys) {
  if (!arKeys.has(key)) {
    arMissingList.push(key);
    missingInAr++;
  }
}

for (const key of arKeys) {
  if (!enKeys.has(key)) {
    enMissingList.push(key);
    missingInEn++;
  }
}

// Check for Chinese characters in Arabic values
const chineseRegex = /[\u4e00-\u9fff]/;
let chineseCount = 0;
const chineseMatches: string[] = [];
for (const [key, value] of Object.entries(arFlat)) {
  if (chineseRegex.test(value)) {
    chineseMatches.push(`${key}: "${value}"`);
    chineseCount++;
  }
}

// Check for raw key patterns that might be rendered in JSX
const rawKeyPatterns = [
  /^\w+\.\w+$/, // e.g. "branches.count"
  /^[a-z]+\.[a-zA-Z]+$/, // e.g. "dashboard.title"
];

console.log("=== B-Attend i18n Parity Check ===\n");
console.log(`English keys: ${enKeys.size}`);
console.log(`Arabic keys:  ${arKeys.size}`);
console.log(`Missing in Arabic: ${missingInAr}`);
console.log(`Missing in English: ${missingInEn}`);
console.log(`Chinese chars in Arabic: ${chineseCount}`);
console.log();

if (arMissingList.length > 0) {
  console.log("❌ Keys missing from Arabic (first 30):");
  arMissingList.slice(0, 30).forEach((k) => console.log(`   ${k}`));
  if (arMissingList.length > 30) console.log(`   ... and ${arMissingList.length - 30} more`);
  console.log();
}

if (enMissingList.length > 0) {
  console.log("⚠️  Keys missing from English (first 30):");
  enMissingList.slice(0, 30).forEach((k) => console.log(`   ${k}`));
  if (enMissingList.length > 30) console.log(`   ... and ${enMissingList.length - 30} more`);
  console.log();
}

if (chineseMatches.length > 0) {
  console.log("❌ Chinese characters found in Arabic translations:");
  chineseMatches.forEach((m) => console.log(`   ${m}`));
  console.log();
}

if (missingInAr === 0 && missingInEn === 0 && chineseCount === 0) {
  console.log("✅ EN/AR parity check passed.\n");
} else {
  console.log("❌ EN/AR parity check failed. Fix the issues above.\n");
  parityFailed = true;
}

// ─── Phase 2: Scan TSX/TS source files for t() calls with missing keys ───
// next-intl uses namespaced t(): useTranslations("ns") → t("key") resolves to "ns.key"
// We need to detect the namespace per-file and prefix bare keys accordingly.

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", "dist", "generated"].includes(entry.name)) continue;
      results.push(...walkDir(full));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

// Match useTranslations("namespace") or getTranslations("namespace")
const useTranslationsRegex = /(?:useTranslations|getTranslations)\(\s*["']([a-zA-Z][a-zA-Z0-9_.]*)["']\s*\)/g;
// Match t("key") or t("key", ...) — key is a single identifier (may contain dots for flat keys)
const tCallRegex = /\bt\(\s*["']([a-zA-Z][a-zA-Z0-9]*[a-zA-Z0-9_.]*)["']\s*(?:,|\))/g;

const srcDir = resolve("src");
const sourceFiles = walkDir(srcDir);

const missingSourceKeys: { file: string; line: number; key: string; resolved: string }[] = [];
const scannedFiles = sourceFiles.length;
let totalTcalls = 0;
let namespacedTcalls = 0;
let flatTcalls = 0;

for (const file of sourceFiles) {
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");

  // Extract all useTranslations("ns") namespaces from this file
  const namespaces: string[] = [];
  for (const line of lines) {
    let nsMatch;
    useTranslationsRegex.lastIndex = 0;
    while ((nsMatch = useTranslationsRegex.exec(line)) !== null) {
      namespaces.push(nsMatch[1]);
    }
  }

  const primaryNs = namespaces[0] || null; // use the first namespace found

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*\/\//.test(line)) continue;

    tCallRegex.lastIndex = 0;
    let match;
    while ((match = tCallRegex.exec(line)) !== null) {
      const key = match[1];
      if (key.length < 3) continue;
      if (key.includes("${")) continue;
      totalTcalls++;

      const hasDot = key.includes(".");
      let resolvedKey = key;

      if (primaryNs) {
        // Always prefix with namespace — even dotted keys: t("validation.x") with ns "policies" → "policies.validation.x"
        namespacedTcalls++;
        resolvedKey = `${primaryNs}.${key}`;
      } else {
        // No namespace context — check as-is (might be global t())
        flatTcalls++;
        resolvedKey = key;
      }

      // Check the resolved key, and also the bare key as fallback
      const keyExists = enKeys.has(resolvedKey) || enKeys.has(key);
      if (!keyExists) {
        missingSourceKeys.push({
          file: relative(process.cwd(), file),
          line: i + 1,
          key,
          resolved: resolvedKey,
        });
      }
    }
  }
}

console.log("=== Source File t() Key Audit ===\n");
console.log(`Scanned: ${scannedFiles} source files`);
console.log(`Total t() calls: ${totalTcalls} (namespaced: ${namespacedTcalls}, flat: ${flatTcalls})`);
console.log(`Keys missing from en.json: ${missingSourceKeys.length}`);

if (missingSourceKeys.length > 0) {
  console.log("\n❌ t() calls referencing keys NOT in messages/en.json:");
  for (const { file, line, key, resolved } of missingSourceKeys.slice(0, 50)) {
    console.log(`   ${file}:${line}  →  t("${key}") [resolved: ${resolved}]`);
  }
  if (missingSourceKeys.length > 50) {
    console.log(`   ... and ${missingSourceKeys.length - 50} more`);
  }
  console.log();
}

// ─── Final Summary ───

console.log("=== Summary ===");
console.log(`EN keys: ${enKeys.size}  |  AR keys: ${arKeys.size}`);
console.log(`Missing in AR: ${missingInAr}  |  Missing in EN: ${missingInEn}`);
console.log(`Chinese chars in AR: ${chineseCount}`);
console.log(`Source keys missing from JSON: ${missingSourceKeys.length}`);

if (missingInAr === 0 && missingInEn === 0 && chineseCount === 0 && missingSourceKeys.length === 0) {
  console.log("\n✅ All checks passed — Arabic and English are in parity, all source keys exist.");
  process.exit(0);
} else {
  console.log("\n❌ Checks failed. Fix the issues above.");
  process.exit(1);
}
