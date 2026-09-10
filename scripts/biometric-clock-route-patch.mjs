import fs from "node:fs";

const path = "src/app/api/mobile/clock/route.ts";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(marker, replacement, label) {
  const count = source.split(marker).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one ${label} marker, found ${count}`);
  source = source.replace(marker, replacement);
}

if (!source.includes('consumeBiometricVerificationSession')) {
  replaceOnce(
`import {
  AttendanceVerificationChallengeError,
  consumeAttendanceVerificationChallenge,
  validateAttendanceVerificationChallenge,
} from "@/lib/attendance/verification-challenge";
`,
`import {
  AttendanceVerificationChallengeError,
  consumeAttendanceVerificationChallenge,
  validateAttendanceVerificationChallenge,
} from "@/lib/attendance/verification-challenge";
import { consumeBiometricVerificationSession } from "@/lib/attendance/biometric-identity";
`,
"biometric import",
  );
}

if (!source.includes('challengeId: input.verification.challengeId,\n        challenge: input.verification.challenge')) {
  replaceOnce(
`        userId: context.user.id,
        challenge: input.verification.challenge,
        evidence: {`,
`        userId: context.user.id,
        challengeId: input.verification.challengeId,
        challenge: input.verification.challenge,
        requiredCapabilities,
        evidence: {`,
"verification provider request",
  );
}

if (!source.includes('await consumeBiometricVerificationSession(tx')) {
  replaceOnce(
`        await consumeAttendanceVerificationChallenge(tx, {
          id: input.verification.challengeId,
          companyId: context.employee.companyId,
          employeeId: context.employee.id,
          userId: context.user.id,
        });
      }

      const created = await tx.punch.create({`,
`        await consumeAttendanceVerificationChallenge(tx, {
          id: input.verification.challengeId,
          companyId: context.employee.companyId,
          employeeId: context.employee.id,
          userId: context.user.id,
        });
        if (input.verification.biometricToken) {
          await consumeBiometricVerificationSession(tx, {
            id: input.verification.biometricToken,
            companyId: context.employee.companyId,
            employeeId: context.employee.id,
            userId: context.user.id,
            attendanceChallengeId: input.verification.challengeId,
          });
        }
      }

      const created = await tx.punch.create({`,
"transactional biometric consumption",
  );
}

fs.writeFileSync(path, source);
console.log("Patched mobile clock route for biometric verification composition.");
