import fs from "node:fs";

// One-off idempotent patcher. Remove after the generated schema is committed.
const path = "prisma/schema.prisma";
let schema = fs.readFileSync(path, "utf8");

if (schema.includes("model BiometricEnrollment {")) {
  console.log("Biometric schema already present; nothing to do.");
  process.exit(0);
}

function replaceOnce(marker, replacement, label) {
  const count = schema.split(marker).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one ${label} marker, found ${count}`);
  schema = schema.replace(marker, replacement);
}

function replaceFirst(marker, replacement, label) {
  if (!schema.includes(marker)) throw new Error(`Missing ${label} marker`);
  schema = schema.replace(marker, replacement);
}

replaceOnce(
`enum AttendanceTrustReviewStatus {
  NOT_REQUIRED
  PENDING
  APPROVED
  REJECTED
}
`,
`enum AttendanceTrustReviewStatus {
  NOT_REQUIRED
  PENDING
  APPROVED
  REJECTED
}

enum BiometricEnrollmentStatus {
  PENDING
  ACTIVE
  REVOKED
  REENROLL_REQUIRED
}

enum BiometricSessionPurpose {
  ENROLLMENT
  ATTENDANCE
}

enum BiometricSessionStatus {
  CREATED
  PROCESSING
  SUCCEEDED
  FAILED
  EXPIRED
  CONSUMED
}
`,
"attendance trust review enum",
);

// This relation pair appears first on Tenant and later on Employee.
replaceFirst(
`  attendanceVerificationChallenges AttendanceVerificationChallenge[]
  attendanceDays                   AttendanceDay[]`,
`  attendanceVerificationChallenges AttendanceVerificationChallenge[]
  biometricEnrollments             BiometricEnrollment[]
  biometricVerificationSessions     BiometricVerificationSession[]
  attendanceDays                   AttendanceDay[]`,
"tenant biometric relations",
);

replaceOnce(
`  roleAssignments      UserRoleAssignment[]
  createdAt`,
`  roleAssignments      UserRoleAssignment[]
  biometricVerificationSessions BiometricVerificationSession[]
  createdAt`,
"user biometric relation",
);

replaceOnce(
`  attendanceVerificationChallenges AttendanceVerificationChallenge[]
  attendanceDays                   AttendanceDay[]`,
`  attendanceVerificationChallenges AttendanceVerificationChallenge[]
  biometricEnrollment              BiometricEnrollment?
  biometricVerificationSessions     BiometricVerificationSession[]
  attendanceDays                   AttendanceDay[]`,
"employee biometric relations",
);

replaceOnce(
`model AttendanceDay {`,
`model BiometricEnrollment {
  id                  String                    @id @default(cuid())
  companyId           String
  tenant              Tenant                    @relation(fields: [companyId], references: [id], onDelete: Cascade)
  employeeId          String                    @unique
  employee            Employee                  @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  providerKey         String
  providerFaceId      String?
  providerSubjectRef  String?
  status              BiometricEnrollmentStatus @default(PENDING)
  enrollmentVersion   Int                       @default(1)
  consentVersion      String?
  consentedAt         DateTime?
  consentedByUserId   String?
  enrolledAt          DateTime?
  revokedAt           DateTime?
  revokeReason        String?
  lastVerifiedAt      DateTime?
  createdAt           DateTime                  @default(now())
  updatedAt           DateTime                  @updatedAt

  verificationSessions BiometricVerificationSession[]

  @@unique([providerKey, providerFaceId])
  @@index([companyId, status])
  @@index([companyId, employeeId])
}

model BiometricVerificationSession {
  id                    String                 @id @default(cuid())
  companyId             String
  tenant                Tenant                 @relation(fields: [companyId], references: [id], onDelete: Cascade)
  employeeId            String
  employee              Employee               @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  userId                String
  user                  User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  purpose               BiometricSessionPurpose
  providerKey           String
  providerSessionId     String                 @unique
  attendanceChallengeId String?                @unique
  enrollmentId          String?
  enrollment            BiometricEnrollment?   @relation(fields: [enrollmentId], references: [id], onDelete: SetNull)
  status                BiometricSessionStatus @default(CREATED)
  expiresAt             DateTime
  completedAt           DateTime?
  consumedAt            DateTime?
  livenessConfidence    Float?
  faceMatchScore        Float?
  failureCode           String?
  providerReference     String?
  createdAt             DateTime               @default(now())
  updatedAt             DateTime               @updatedAt

  @@index([companyId, employeeId, purpose, status])
  @@index([companyId, userId, expiresAt])
  @@index([companyId, attendanceChallengeId])
}

model AttendanceDay {`,
"biometric models insertion point",
);

fs.writeFileSync(path, schema);
console.log("Patched Prisma schema with biometric identity models.");
