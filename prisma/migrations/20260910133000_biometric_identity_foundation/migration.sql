-- Biometric identity/liveness persistence. No raw biometric media is stored here.
CREATE TYPE "BiometricEnrollmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED', 'REENROLL_REQUIRED');
CREATE TYPE "BiometricSessionPurpose" AS ENUM ('ENROLLMENT', 'ATTENDANCE');
CREATE TYPE "BiometricSessionStatus" AS ENUM ('CREATED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CONSUMED');

CREATE TABLE "BiometricEnrollment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "providerFaceId" TEXT,
    "providerSubjectRef" TEXT,
    "status" "BiometricEnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "enrollmentVersion" INTEGER NOT NULL DEFAULT 1,
    "consentVersion" TEXT,
    "consentedAt" TIMESTAMP(3),
    "consentedByUserId" TEXT,
    "enrolledAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BiometricEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BiometricVerificationSession" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "BiometricSessionPurpose" NOT NULL,
    "providerKey" TEXT NOT NULL,
    "providerSessionId" TEXT NOT NULL,
    "attendanceChallengeId" TEXT,
    "enrollmentId" TEXT,
    "status" "BiometricSessionStatus" NOT NULL DEFAULT 'CREATED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "livenessConfidence" DOUBLE PRECISION,
    "faceMatchScore" DOUBLE PRECISION,
    "failureCode" TEXT,
    "providerReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BiometricVerificationSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BiometricEnrollment_employeeId_key" ON "BiometricEnrollment"("employeeId");
CREATE UNIQUE INDEX "BiometricEnrollment_providerKey_providerFaceId_key" ON "BiometricEnrollment"("providerKey", "providerFaceId");
CREATE INDEX "BiometricEnrollment_companyId_status_idx" ON "BiometricEnrollment"("companyId", "status");
CREATE INDEX "BiometricEnrollment_companyId_employeeId_idx" ON "BiometricEnrollment"("companyId", "employeeId");

CREATE UNIQUE INDEX "BiometricVerificationSession_providerSessionId_key" ON "BiometricVerificationSession"("providerSessionId");
CREATE UNIQUE INDEX "BiometricVerificationSession_attendanceChallengeId_key" ON "BiometricVerificationSession"("attendanceChallengeId");
CREATE INDEX "BiometricVerificationSession_companyId_employeeId_purpose_status_idx" ON "BiometricVerificationSession"("companyId", "employeeId", "purpose", "status");
CREATE INDEX "BiometricVerificationSession_companyId_userId_expiresAt_idx" ON "BiometricVerificationSession"("companyId", "userId", "expiresAt");
CREATE INDEX "BiometricVerificationSession_companyId_attendanceChallengeId_idx" ON "BiometricVerificationSession"("companyId", "attendanceChallengeId");

ALTER TABLE "BiometricEnrollment"
  ADD CONSTRAINT "BiometricEnrollment_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BiometricEnrollment"
  ADD CONSTRAINT "BiometricEnrollment_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BiometricVerificationSession"
  ADD CONSTRAINT "BiometricVerificationSession_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BiometricVerificationSession"
  ADD CONSTRAINT "BiometricVerificationSession_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BiometricVerificationSession"
  ADD CONSTRAINT "BiometricVerificationSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BiometricVerificationSession"
  ADD CONSTRAINT "BiometricVerificationSession_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "BiometricEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
