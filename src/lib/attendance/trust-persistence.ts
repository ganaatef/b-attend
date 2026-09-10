import type { Prisma, PunchSource, AttendanceTrustReviewStatus } from "@prisma/client";
import type { AttendanceTrustAssessment as TrustEngineAssessment } from "@/lib/attendance/trust-engine";

type TrustWriter = Pick<Prisma.TransactionClient, "attendanceTrustAssessment">;

export async function persistAttendanceTrustAssessment(
  tx: TrustWriter,
  input: {
    companyId: string;
    punchId: string;
    source: PunchSource;
    assessment: TrustEngineAssessment;
    reviewStatus?: AttendanceTrustReviewStatus;
    /** Sanitized provider metadata only. Never raw verification tokens/media. */
    evidence?: unknown;
  },
) {
  return tx.attendanceTrustAssessment.create({
    data: {
      companyId: input.companyId,
      punchId: input.punchId,
      source: input.source,
      policyVersion: input.assessment.policyVersion,
      score: input.assessment.score,
      riskLevel: input.assessment.riskLevel,
      decision: input.assessment.decision,
      criticalRisk: input.assessment.criticalRisk,
      signalsJson: JSON.stringify(input.assessment.signals),
      reasonsJson: JSON.stringify(input.assessment.reasons),
      evidenceJson: input.evidence == null ? null : JSON.stringify(input.evidence),
      reviewStatus: input.reviewStatus ?? "NOT_REQUIRED",
    },
  });
}

export function parseTrustReasons(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
