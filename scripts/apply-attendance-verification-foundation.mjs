import fs from "node:fs";
import path from "node:path";

const schema = "prisma/schema.prisma";

function updateModel(modelName, mutator) {
  const current = fs.readFileSync(schema, "utf8");
  const start = current.indexOf(`model ${modelName} {`);
  if (start < 0) throw new Error(`Model not found: ${modelName}`);
  const next = current.indexOf("\nmodel ", start + 1);
  const end = next < 0 ? current.length : next;
  const block = current.slice(start, end);
  const changed = mutator(block);
  if (changed === block) return false;
  fs.writeFileSync(schema, current.slice(0, start) + changed + current.slice(end));
  return true;
}

function insertAfterLine(block, lineRegex, newLine, marker) {
  if (block.includes(marker)) return block;
  if (!lineRegex.test(block)) throw new Error(`Anchor not found for ${marker}`);
  return block.replace(lineRegex, (line) => `${line}\n${newLine}`);
}

updateModel("Tenant", (block) => insertAfterLine(
  block,
  /^\s*attendanceTrustAssessments\s+AttendanceTrustAssessment\[\].*$/m,
  "  attendanceVerificationChallenges AttendanceVerificationChallenge[]",
  "attendanceVerificationChallenges",
));

updateModel("CompanySettings", (block) => insertAfterLine(
  block,
  /^\s*trustBlockCriticalRisk\s+Boolean\s+@default\(false\).*$/m,
  "  trustRequireDeviceIntegrity      Boolean  @default(false)",
  "trustRequireDeviceIntegrity",
));

updateModel("Employee", (block) => insertAfterLine(
  block,
  /^\s*punches\s+Punch\[\].*$/m,
  "  attendanceVerificationChallenges AttendanceVerificationChallenge[]",
  "attendanceVerificationChallenges",
));

updateModel("AttendanceTrustAssessment", (block) => insertAfterLine(
  block,
  /^\s*reasonsJson\s+String\?.*$/m,
  "  evidenceJson  String?",
  "evidenceJson",
));

let schemaText = fs.readFileSync(schema, "utf8");
if (!schemaText.includes("model AttendanceVerificationChallenge {")) {
  const marker = "model AttendanceDay {";
  if (!schemaText.includes(marker)) throw new Error("AttendanceDay model anchor not found");
  const model = `model AttendanceVerificationChallenge {
  id                    String   @id @default(cuid())
  companyId             String
  tenant                Tenant   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  employeeId            String
  employee              Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  userId                String
  nonceHash             String   @unique
  providerKey           String
  requestedCapabilities String
  expiresAt             DateTime
  consumedAt            DateTime?
  createdAt             DateTime @default(now())

  @@index([companyId, employeeId, expiresAt])
  @@index([companyId, consumedAt])
}

`;
  schemaText = schemaText.replace(marker, model + marker);
  fs.writeFileSync(schema, schemaText);
}

const migrationDir = "prisma/migrations/20260910110000_attendance_verification_foundation";
fs.mkdirSync(migrationDir, { recursive: true });
const migrationPath = path.join(migrationDir, "migration.sql");
if (!fs.existsSync(migrationPath)) {
  fs.writeFileSync(migrationPath, `ALTER TABLE "CompanySettings"
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
`);
}

for (const locale of ["en", "ar"]) {
  const file = `messages/${locale}.json`;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.settings ??= {};
  if (locale === "ar") {
    data.settings.trustRequireDeviceIntegrity = "اشتراط التحقق من سلامة الجهاز في تطبيق الموظف";
    data.settings.trustRequireFace = "اشتراط مطابقة الوجه في تطبيق الموظف";
    data.settings.trustRequireLiveness = "اشتراط فحص حيوية الوجه في تطبيق الموظف";
    data.settings.verificationPolicyNotice = "لا يمكن تفعيل متطلبات سلامة الجهاز أو الوجه أو الحيوية قبل توصيل مزود تحقق فعلي. لا يعتمد B-Attend على ادعاءات التطبيق كدليل موثوق.";
  } else {
    data.settings.trustRequireDeviceIntegrity = "Require native device integrity verification";
    data.settings.trustRequireFace = "Require face match verification";
    data.settings.trustRequireLiveness = "Require face liveness verification";
    data.settings.verificationPolicyNotice = "Device, face, or liveness requirements cannot be enabled until a real verification provider is connected. B-Attend never treats client assertions as trusted evidence.";
  }
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

console.log("Attendance verification schema foundation applied.");
