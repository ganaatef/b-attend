import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function replaceExact(file, from, to) {
  const current = fs.readFileSync(file, "utf8");
  if (current.includes(to)) return false;
  if (!current.includes(from)) {
    throw new Error(`Expected patch anchor not found in ${file}: ${from.slice(0, 100)}`);
  }
  fs.writeFileSync(file, current.replace(from, to));
  return true;
}

const schema = "prisma/schema.prisma";

replaceExact(
  schema,
  `enum PunchStatus {\n  ACCEPTED\n  NEEDS_APPROVAL\n  REJECTED\n}\n`,
  `enum PunchStatus {\n  ACCEPTED\n  NEEDS_APPROVAL\n  REJECTED\n}\n\nenum AttendanceTrustDecision {\n  ACCEPT\n  REVIEW\n  REJECT\n}\n\nenum AttendanceTrustRisk {\n  LOW\n  MEDIUM\n  HIGH\n  CRITICAL\n}\n\nenum AttendanceTrustReviewStatus {\n  NOT_REQUIRED\n  PENDING\n  APPROVED\n  REJECTED\n}\n`,
);

replaceExact(
  schema,
  `  punches                Punch[]\n  attendanceDays         AttendanceDay[]\n`,
  `  punches                Punch[]\n  attendanceTrustAssessments AttendanceTrustAssessment[]\n  attendanceDays         AttendanceDay[]\n`,
);

replaceExact(
  schema,
  `  enableBranchManagerApprovals    Boolean  @default(true)\n  payrollIntegration              String?\n`,
  `  enableBranchManagerApprovals    Boolean  @default(true)\n  trustPolicyVersion               String   @default("tenant-trust-v1")\n  trustReviewBelow                 Int      @default(75)\n  trustRejectBelow                 Int      @default(30)\n  trustBlockCriticalRisk           Boolean  @default(false)\n  trustRequireFace                 Boolean  @default(false)\n  trustRequireLiveness             Boolean  @default(false)\n  biometricRetentionHours          Int      @default(24)\n  payrollIntegration              String?\n`,
);

replaceExact(
  schema,
  `  userAgent      String?\n  createdAt      DateTime    @default(now())\n\n  @@index([companyId, employeeId])\n`,
  `  userAgent      String?\n  createdAt      DateTime    @default(now())\n  trustAssessment AttendanceTrustAssessment?\n\n  @@index([companyId, employeeId])\n`,
);

replaceExact(
  schema,
  `model AttendanceDay {\n`,
  `model AttendanceTrustAssessment {\n  id            String                      @id @default(cuid())\n  companyId     String\n  tenant        Tenant                      @relation(fields: [companyId], references: [id], onDelete: Cascade)\n  punchId       String                      @unique\n  punch         Punch                       @relation(fields: [punchId], references: [id], onDelete: Cascade)\n  policyVersion String\n  score         Int\n  riskLevel     AttendanceTrustRisk\n  decision      AttendanceTrustDecision\n  criticalRisk  Boolean                     @default(false)\n  source        PunchSource\n  signalsJson   String\n  reasonsJson   String?\n  reviewStatus  AttendanceTrustReviewStatus @default(NOT_REQUIRED)\n  reviewedById  String?\n  reviewedAt    DateTime?\n  reviewNotes   String?\n  createdAt     DateTime                    @default(now())\n  updatedAt     DateTime                    @updatedAt\n\n  @@index([companyId, createdAt])\n  @@index([companyId, riskLevel])\n  @@index([companyId, reviewStatus])\n}\n\nmodel AttendanceDay {\n`,
);

const migrationDir = "prisma/migrations/20260910020000_attendance_trust_normalization";
fs.mkdirSync(migrationDir, { recursive: true });
const migrationPath = path.join(migrationDir, "migration.sql");
if (!fs.existsSync(migrationPath)) throw new Error("Trust normalization migration is missing");

await import("./integrate-trust-v2.mjs");

// The verifier's existing commit step stages foundation paths. Stage integration
// outputs here so they are committed only after all verification steps pass.
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

console.log("Attendance Trust normalization + v2 integration patch applied.");
