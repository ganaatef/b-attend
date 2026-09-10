import fs from "node:fs";

const path = "src/lib/attendance/providers/aws-rekognition-biometric.ts";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(marker, replacement, label) {
  const count = source.split(marker).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one ${label} marker, found ${count}`);
  source = source.replace(marker, replacement);
}

replaceOnce(
`import { createHash, createHmac } from "node:crypto";`,
`import { createHash, createHmac } from "node:crypto";
import { isRekognitionFaceLivenessRegion } from "@/lib/attendance/providers/rekognition-liveness-regions";`,
"region helper import",
);

replaceOnce(
`export function loadAwsRekognitionBiometricConfig(): AwsRekognitionBiometricConfig {
  const livenessThreshold`,
`export function loadAwsRekognitionBiometricConfig(): AwsRekognitionBiometricConfig {
  const region = requiredEnv("AWS_REKOGNITION_REGION");
  if (!isRekognitionFaceLivenessRegion(region)) {
    throw new AwsRekognitionBiometricConfigurationError(
      \`AWS_REKOGNITION_REGION does not support Face Liveness: \${region}\`,
    );
  }

  const livenessThreshold`,
"region validation",
);

replaceOnce(
`    region: requiredEnv("AWS_REKOGNITION_REGION"),`,
`    region,`,
"validated region assignment",
);

fs.writeFileSync(path, source);
console.log("Applied runtime Face Liveness region validation.");

// trigger 2026-09-10T16:10Z
