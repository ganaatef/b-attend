/**
 * i18n parity checker — compare Arabic and English translation files.
 * Run: npx tsx scripts/check-missing-translations.ts
 * Or: npm run i18n:check
 */
import { readFileSync } from "fs";
import { resolve } from "path";

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
  console.log("✅ All checks passed — Arabic and English are in parity.");
  process.exit(0);
} else {
  console.log("❌ Parity check failed. Fix the issues above.");
  process.exit(1);
}
