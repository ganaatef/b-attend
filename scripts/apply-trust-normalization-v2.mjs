import fs from "node:fs";
import path from "node:path";

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
fs.writeFileSync(path.join(migrationDir, "migration.sql"), `CREATE TYPE "AttendanceTrustDecision" AS ENUM ('ACCEPT', 'REVIEW', 'REJECT');\nCREATE TYPE "AttendanceTrustRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');\nCREATE TYPE "AttendanceTrustReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');\n\nALTER TABLE "CompanySettings"\n  ADD COLUMN "trustPolicyVersion" TEXT NOT NULL DEFAULT 'tenant-trust-v1',\n  ADD COLUMN "trustReviewBelow" INTEGER NOT NULL DEFAULT 75,\n  ADD COLUMN "trustRejectBelow" INTEGER NOT NULL DEFAULT 30,\n  ADD COLUMN "trustBlockCriticalRisk" BOOLEAN NOT NULL DEFAULT false,\n  ADD COLUMN "trustRequireFace" BOOLEAN NOT NULL DEFAULT false,\n  ADD COLUMN "trustRequireLiveness" BOOLEAN NOT NULL DEFAULT false,\n  ADD COLUMN "biometricRetentionHours" INTEGER NOT NULL DEFAULT 24;\n\nCREATE TABLE "AttendanceTrustAssessment" (\n    "id" TEXT NOT NULL,\n    "companyId" TEXT NOT NULL,\n    "punchId" TEXT NOT NULL,\n    "policyVersion" TEXT NOT NULL,\n    "score" INTEGER NOT NULL,\n    "riskLevel" "AttendanceTrustRisk" NOT NULL,\n    "decision" "AttendanceTrustDecision" NOT NULL,\n    "criticalRisk" BOOLEAN NOT NULL DEFAULT false,\n    "source" "PunchSource" NOT NULL,\n    "signalsJson" TEXT NOT NULL,\n    "reasonsJson" TEXT,\n    "reviewStatus" "AttendanceTrustReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',\n    "reviewedById" TEXT,\n    "reviewedAt" TIMESTAMP(3),\n    "reviewNotes" TEXT,\n    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    "updatedAt" TIMESTAMP(3) NOT NULL,\n    CONSTRAINT "AttendanceTrustAssessment_pkey" PRIMARY KEY ("id")\n);\n\nCREATE UNIQUE INDEX "AttendanceTrustAssessment_punchId_key" ON "AttendanceTrustAssessment"("punchId");\nCREATE INDEX "AttendanceTrustAssessment_companyId_createdAt_idx" ON "AttendanceTrustAssessment"("companyId", "createdAt");\nCREATE INDEX "AttendanceTrustAssessment_companyId_riskLevel_idx" ON "AttendanceTrustAssessment"("companyId", "riskLevel");\nCREATE INDEX "AttendanceTrustAssessment_companyId_reviewStatus_idx" ON "AttendanceTrustAssessment"("companyId", "reviewStatus");\n\nALTER TABLE "AttendanceTrustAssessment" ADD CONSTRAINT "AttendanceTrustAssessment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;\nALTER TABLE "AttendanceTrustAssessment" ADD CONSTRAINT "AttendanceTrustAssessment_punchId_fkey" FOREIGN KEY ("punchId") REFERENCES "Punch"("id") ON DELETE CASCADE ON UPDATE CASCADE;\n`);

fs.mkdirSync("src/lib/attendance", { recursive: true });
fs.writeFileSync("src/lib/attendance/trust-policy.ts", `import type { CompanySettings } from "@prisma/client";\nimport {\n  DEFAULT_ATTENDANCE_TRUST_POLICY,\n  type AttendanceTrustPolicy,\n} from "@/lib/attendance/trust-engine";\n\ntype TrustPolicySettings = Pick<\n  CompanySettings,\n  | "trustPolicyVersion"\n  | "trustReviewBelow"\n  | "trustRejectBelow"\n  | "trustBlockCriticalRisk"\n  | "trustRequireFace"\n  | "trustRequireLiveness"\n>;\n\nfunction boundedInt(value: number | null | undefined, fallback: number, min: number, max: number) {\n  if (!Number.isInteger(value)) return fallback;\n  return Math.max(min, Math.min(max, value as number));\n}\n\nexport function attendanceTrustPolicyFromSettings(\n  settings: TrustPolicySettings | null | undefined,\n): AttendanceTrustPolicy {\n  const reviewBelow = boundedInt(settings?.trustReviewBelow, DEFAULT_ATTENDANCE_TRUST_POLICY.reviewBelow, 1, 100);\n  const rejectBelow = Math.min(\n    reviewBelow - 1,\n    boundedInt(settings?.trustRejectBelow, DEFAULT_ATTENDANCE_TRUST_POLICY.rejectBelow, 0, 99),\n  );\n  const configuredVersion = settings?.trustPolicyVersion?.trim() || "tenant-trust-v1";\n  const fingerprint = [\n    configuredVersion,\n    \`review-\${reviewBelow}\`,\n    \`reject-\${rejectBelow}\`,\n    \`critical-\${settings?.trustBlockCriticalRisk ? 1 : 0}\`,\n    \`face-\${settings?.trustRequireFace ? 1 : 0}\`,\n    \`live-\${settings?.trustRequireLiveness ? 1 : 0}\`,\n  ].join(":");\n\n  return {\n    version: \`\${DEFAULT_ATTENDANCE_TRUST_POLICY.version}:\${fingerprint}\`,\n    reviewBelow,\n    rejectBelow,\n    blockCriticalRisk: settings?.trustBlockCriticalRisk ?? DEFAULT_ATTENDANCE_TRUST_POLICY.blockCriticalRisk,\n    requireFace: settings?.trustRequireFace ?? DEFAULT_ATTENDANCE_TRUST_POLICY.requireFace,\n    requireLiveness: settings?.trustRequireLiveness ?? DEFAULT_ATTENDANCE_TRUST_POLICY.requireLiveness,\n  };\n}\n`);

fs.writeFileSync("src/lib/attendance/trust-persistence.ts", `import type { Prisma, PunchSource, AttendanceTrustReviewStatus } from "@prisma/client";\nimport type { AttendanceTrustAssessment as TrustEngineAssessment } from "@/lib/attendance/trust-engine";\n\ntype TrustWriter = Pick<Prisma.TransactionClient, "attendanceTrustAssessment">;\n\nexport async function persistAttendanceTrustAssessment(\n  tx: TrustWriter,\n  input: {\n    companyId: string;\n    punchId: string;\n    source: PunchSource;\n    assessment: TrustEngineAssessment;\n    reviewStatus?: AttendanceTrustReviewStatus;\n  },\n) {\n  return tx.attendanceTrustAssessment.create({\n    data: {\n      companyId: input.companyId,\n      punchId: input.punchId,\n      source: input.source,\n      policyVersion: input.assessment.policyVersion,\n      score: input.assessment.score,\n      riskLevel: input.assessment.riskLevel,\n      decision: input.assessment.decision,\n      criticalRisk: input.assessment.criticalRisk,\n      signalsJson: JSON.stringify(input.assessment.signals),\n      reasonsJson: JSON.stringify(input.assessment.reasons),\n      reviewStatus: input.reviewStatus ?? "NOT_REQUIRED",\n    },\n  });\n}\n\nexport function parseTrustReasons(value: string | null): string[] {\n  if (!value) return [];\n  try {\n    const parsed = JSON.parse(value);\n    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];\n  } catch {\n    return [];\n  }\n}\n`);

console.log("Attendance Trust normalization patch applied.");
