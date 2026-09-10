ALTER TABLE "CompanySettings"
  ADD COLUMN "trustRequireDeviceIntegrity" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AttendanceTrustAssessment"
  ADD COLUMN "evidenceJson" TEXT;

CREATE TABLE "AttendanceVerificationChallenge" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nonceHash" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "requestedCapabilities" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceVerificationChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttendanceVerificationChallenge_nonceHash_key"
  ON "AttendanceVerificationChallenge"("nonceHash");
CREATE INDEX "AttendanceVerificationChallenge_companyId_employeeId_expiresAt_idx"
  ON "AttendanceVerificationChallenge"("companyId", "employeeId", "expiresAt");
CREATE INDEX "AttendanceVerificationChallenge_companyId_consumedAt_idx"
  ON "AttendanceVerificationChallenge"("companyId", "consumedAt");

ALTER TABLE "AttendanceVerificationChallenge"
  ADD CONSTRAINT "AttendanceVerificationChallenge_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceVerificationChallenge"
  ADD CONSTRAINT "AttendanceVerificationChallenge_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
