CREATE TYPE "AttendanceTrustDecision" AS ENUM ('ACCEPT', 'REVIEW', 'REJECT');
CREATE TYPE "AttendanceTrustRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "AttendanceTrustReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "CompanySettings"
  ADD COLUMN "trustPolicyVersion" TEXT NOT NULL DEFAULT 'tenant-trust-v1',
  ADD COLUMN "trustReviewBelow" INTEGER NOT NULL DEFAULT 75,
  ADD COLUMN "trustRejectBelow" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "trustBlockCriticalRisk" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "trustRequireFace" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "trustRequireLiveness" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "biometricRetentionHours" INTEGER NOT NULL DEFAULT 24;

CREATE TABLE "AttendanceTrustAssessment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "punchId" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "riskLevel" "AttendanceTrustRisk" NOT NULL,
    "decision" "AttendanceTrustDecision" NOT NULL,
    "criticalRisk" BOOLEAN NOT NULL DEFAULT false,
    "source" "PunchSource" NOT NULL,
    "signalsJson" TEXT NOT NULL,
    "reasonsJson" TEXT,
    "reviewStatus" "AttendanceTrustReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendanceTrustAssessment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttendanceTrustAssessment_punchId_key" ON "AttendanceTrustAssessment"("punchId");
CREATE INDEX "AttendanceTrustAssessment_companyId_createdAt_idx" ON "AttendanceTrustAssessment"("companyId", "createdAt");
CREATE INDEX "AttendanceTrustAssessment_companyId_riskLevel_idx" ON "AttendanceTrustAssessment"("companyId", "riskLevel");
CREATE INDEX "AttendanceTrustAssessment_companyId_reviewStatus_idx" ON "AttendanceTrustAssessment"("companyId", "reviewStatus");

ALTER TABLE "AttendanceTrustAssessment" ADD CONSTRAINT "AttendanceTrustAssessment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceTrustAssessment" ADD CONSTRAINT "AttendanceTrustAssessment_punchId_fkey" FOREIGN KEY ("punchId") REFERENCES "Punch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
