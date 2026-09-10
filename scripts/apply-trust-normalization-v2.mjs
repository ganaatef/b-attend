import fs from "node:fs";
import { execFileSync } from "node:child_process";

const requiredFoundation = [
  "prisma/migrations/20260910020000_attendance_trust_normalization/migration.sql",
  "src/lib/attendance/trust-policy.ts",
  "src/lib/attendance/trust-persistence.ts",
];
for (const file of requiredFoundation) {
  if (!fs.existsSync(file)) throw new Error(`Trust normalization foundation is missing: ${file}`);
}

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
for (const required of [
  "model AttendanceTrustAssessment",
  "enum AttendanceTrustDecision",
  "enum AttendanceTrustReviewStatus",
  "trustReviewBelow",
  "biometricRetentionHours",
]) {
  if (!schema.includes(required)) throw new Error(`Trust schema foundation is incomplete: ${required}`);
}

await import("./integrate-trust-v2.mjs");

// The verifier's existing commit step stages foundation paths. Stage integration
// outputs here so they are committed only after every verification step passes.
execFileSync("git", ["add",
  "src/app/(tenant)/clock/actions.ts",
  "src/app/(tenant)/approvals/actions.ts",
  "src/app/(tenant)/live/page.tsx",
  "src/lib/attendance/engine.ts",
  "src/app/(tenant)/settings/actions.ts",
  "src/app/(tenant)/settings/CustomerSettingsForm.tsx",
  "messages/en.json",
  "messages/ar.json",
  "tests/trust-policy.test.ts",
  "tests/runtime/trust-approval.test.ts",
]);

console.log("Attendance Trust v2 integration patch applied on normalized foundation.");
