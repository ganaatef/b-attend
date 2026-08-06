/**
 * Sensitive data classification for B-Attend.
 * Fields marked HIGH require encryption at rest and masking in UI.
 */

export const SENSITIVE_FIELDS = {
  HIGH: ["nationalId", "bankAccount", "walletNumber", "salary"],
  MEDIUM: ["phone", "email", "address", "emergencyContact"],
  LOW: ["fullName", "jobTitle"],
} as const;

export type SensitivityLevel = keyof typeof SENSITIVE_FIELDS;

export function getFieldSensitivity(field: string): SensitivityLevel {
  for (const [level, fields] of Object.entries(SENSITIVE_FIELDS)) {
    if ((fields as readonly string[]).includes(field)) return level as SensitivityLevel;
  }
  return "LOW";
}
