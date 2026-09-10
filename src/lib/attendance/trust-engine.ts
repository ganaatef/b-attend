export type AttendanceTrustDecision = "ACCEPT" | "REVIEW" | "REJECT";
export type AttendanceTrustRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AttendanceTrustSignalState = "PASS" | "WARN" | "FAIL" | "UNKNOWN";
export type MockLocationRisk = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

export type AttendanceSource = "MOBILE_APP" | "MOBILE_WEB" | "KIOSK" | "MANUAL_ADJUSTMENT" | "ADMIN";

export interface AttendanceTrustSignal {
  key: string;
  state: AttendanceTrustSignalState;
  penalty: number;
  reason: string;
}

export interface AttendanceTrustPolicy {
  version: string;
  reviewBelow: number;
  rejectBelow: number;
  blockCriticalRisk: boolean;
  requireDeviceIntegrity: boolean;
  requireFace: boolean;
  requireLiveness: boolean;
}

export interface AttendanceTrustInput {
  source: AttendanceSource;
  insideGeofence: boolean;
  distanceMeters?: number | null;
  accuracyMeters?: number | null;
  deviceTrusted?: boolean | null;
  mockLocationRisk?: MockLocationRisk | null;
  faceMatchScore?: number | null;
  livenessPassed?: boolean | null;
  impossibleTravel?: boolean | null;
}

export interface AttendanceTrustAssessment {
  policyVersion: string;
  score: number;
  riskLevel: AttendanceTrustRisk;
  decision: AttendanceTrustDecision;
  criticalRisk: boolean;
  signals: AttendanceTrustSignal[];
  reasons: string[];
}

export const DEFAULT_ATTENDANCE_TRUST_POLICY: AttendanceTrustPolicy = {
  version: "trust-v1.1",
  reviewBelow: 75,
  rejectBelow: 30,
  // Default policy is deliberately review-first. Hard rejection only happens
  // after a tenant explicitly opts into blocking critical verification risk.
  blockCriticalRisk: false,
  requireDeviceIntegrity: false,
  requireFace: false,
  requireLiveness: false,
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function mobileSource(source: AttendanceSource): boolean {
  return source === "MOBILE_APP" || source === "MOBILE_WEB";
}

export function assessAttendanceTrust(
  input: AttendanceTrustInput,
  policy: AttendanceTrustPolicy = DEFAULT_ATTENDANCE_TRUST_POLICY,
): AttendanceTrustAssessment {
  const signals: AttendanceTrustSignal[] = [];
  let score = 100;
  let criticalRisk = false;

  const add = (
    key: string,
    state: AttendanceTrustSignalState,
    penalty: number,
    reason: string,
    critical = false,
  ) => {
    signals.push({ key, state, penalty, reason });
    score -= penalty;
    if (critical) criticalRisk = true;
  };

  if (input.insideGeofence) {
    add("geofence", "PASS", 0, "Location is inside the configured geofence");
  } else {
    add("geofence", "FAIL", 40, "Location is outside the configured geofence");
  }

  if (mobileSource(input.source)) {
    if (input.accuracyMeters == null) {
      add("gps_accuracy", "UNKNOWN", 5, "GPS accuracy was not provided");
    } else if (input.accuracyMeters <= 30) {
      add("gps_accuracy", "PASS", 0, "GPS accuracy is strong");
    } else if (input.accuracyMeters <= 75) {
      add("gps_accuracy", "WARN", 5, "GPS accuracy is acceptable but not strong");
    } else if (input.accuracyMeters <= 150) {
      add("gps_accuracy", "WARN", 15, "GPS accuracy is weak");
    } else {
      add("gps_accuracy", "FAIL", 30, "GPS accuracy is too weak for high-confidence verification");
    }
  } else {
    add("gps_accuracy", "UNKNOWN", 0, "GPS accuracy is not required for this attendance source");
  }

  // Native-app device integrity is provider-verified. Mobile-web and kiosk have
  // different trust mechanisms and are never penalized merely because a native
  // attestation provider is not applicable to them.
  if (input.source === "MOBILE_APP") {
    if (input.deviceTrusted === true) {
      add("device_trust", "PASS", 0, "Native device integrity verification passed");
    } else if (input.deviceTrusted === false) {
      add("device_trust", "FAIL", 40, "Native device integrity verification failed", true);
    } else if (policy.requireDeviceIntegrity) {
      add("device_trust", "FAIL", 45, "Device integrity verification is required but was not completed", true);
    } else {
      add("device_trust", "UNKNOWN", 0, "Native device integrity verification is not required by the current policy");
    }
  } else if (input.deviceTrusted === true) {
    add("device_trust", "PASS", 0, "Attendance came from a trusted registered device");
  } else if (input.deviceTrusted === false) {
    add("device_trust", "FAIL", 25, "Device trust verification failed");
  } else {
    add("device_trust", "UNKNOWN", 0, "Native device integrity verification is not applicable to this attendance source");
  }

  const mockRisk = input.mockLocationRisk ?? "UNKNOWN";
  if (mockRisk === "NONE") {
    add("mock_location", "PASS", 0, "No mock-location risk was detected");
  } else if (mockRisk === "LOW") {
    add("mock_location", "WARN", 10, "Low mock-location risk signal detected");
  } else if (mockRisk === "MEDIUM") {
    add("mock_location", "WARN", 25, "Medium mock-location risk signal detected");
  } else if (mockRisk === "HIGH") {
    add("mock_location", "FAIL", 50, "High mock-location risk signal detected", true);
  } else {
    add("mock_location", "UNKNOWN", 0, "Mock-location verification is not available yet");
  }

  // Face/liveness policy is currently bound to the native employee app. A
  // company can continue to operate kiosk/web channels even after enabling
  // native biometric verification.
  if (input.source !== "MOBILE_APP") {
    add("face_match", "UNKNOWN", 0, "Face verification is not applicable to this attendance source");
    add("liveness", "UNKNOWN", 0, "Liveness verification is not applicable to this attendance source");
  } else {
    if (input.faceMatchScore == null) {
      if (policy.requireFace) {
        add("face_match", "FAIL", 50, "Face verification is required but was not completed", true);
      } else {
        add("face_match", "UNKNOWN", 0, "Face verification is not required by the current policy");
      }
    } else if (input.faceMatchScore >= 0.9) {
      add("face_match", "PASS", 0, "Face match confidence is high");
    } else if (input.faceMatchScore >= 0.75) {
      add("face_match", "WARN", 15, "Face match confidence is below the preferred threshold");
    } else {
      add("face_match", "FAIL", 40, "Face match confidence is low");
    }

    if (input.livenessPassed == null) {
      if (policy.requireLiveness) {
        add("liveness", "FAIL", 50, "Liveness verification is required but was not completed", true);
      } else {
        add("liveness", "UNKNOWN", 0, "Liveness verification is not required by the current policy");
      }
    } else if (input.livenessPassed) {
      add("liveness", "PASS", 0, "Liveness verification passed");
    } else {
      add("liveness", "FAIL", 50, "Liveness verification failed", true);
    }
  }

  if (input.impossibleTravel === true) {
    add("impossible_travel", "FAIL", 60, "Location movement is not physically plausible", true);
  } else if (input.impossibleTravel === false) {
    add("impossible_travel", "PASS", 0, "No impossible-travel anomaly was detected");
  } else {
    add("impossible_travel", "UNKNOWN", 0, "Impossible-travel detection is not available yet");
  }

  const finalScore = clampScore(score);
  let riskLevel: AttendanceTrustRisk = "LOW";
  if (criticalRisk) riskLevel = "CRITICAL";
  else if (finalScore < 50) riskLevel = "HIGH";
  else if (finalScore < policy.reviewBelow) riskLevel = "MEDIUM";

  let decision: AttendanceTrustDecision = "ACCEPT";
  if (criticalRisk && policy.blockCriticalRisk) decision = "REJECT";
  else if (finalScore < policy.reviewBelow || criticalRisk) decision = "REVIEW";

  if (policy.blockCriticalRisk && finalScore < policy.rejectBelow) decision = "REJECT";

  return {
    policyVersion: policy.version,
    score: finalScore,
    riskLevel,
    decision,
    criticalRisk,
    signals,
    reasons: signals.filter((signal) => signal.state === "WARN" || signal.state === "FAIL").map((signal) => signal.reason),
  };
}
