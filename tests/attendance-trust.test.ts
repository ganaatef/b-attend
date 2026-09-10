import { describe, expect, it } from "vitest";
import { assessAttendanceTrust, DEFAULT_ATTENDANCE_TRUST_POLICY } from "@/lib/attendance/trust-engine";

describe("Attendance Trust Engine", () => {
  it("accepts an accurate in-geofence mobile punch", () => {
    const result = assessAttendanceTrust({
      source: "MOBILE_APP",
      insideGeofence: true,
      distanceMeters: 12,
      accuracyMeters: 8,
      mockLocationRisk: "NONE",
      impossibleTravel: false,
    });

    expect(result.score).toBe(100);
    expect(result.riskLevel).toBe("LOW");
    expect(result.decision).toBe("ACCEPT");
  });

  it("routes an outside-geofence punch to review", () => {
    const result = assessAttendanceTrust({
      source: "MOBILE_APP",
      insideGeofence: false,
      distanceMeters: 420,
      accuracyMeters: 15,
      mockLocationRisk: "NONE",
      impossibleTravel: false,
    });

    expect(result.score).toBe(60);
    expect(result.riskLevel).toBe("MEDIUM");
    expect(result.decision).toBe("REVIEW");
  });

  it("penalizes weak GPS accuracy separately from geofence distance", () => {
    const result = assessAttendanceTrust({
      source: "MOBILE_APP",
      insideGeofence: true,
      accuracyMeters: 220,
    });

    expect(result.score).toBe(70);
    expect(result.decision).toBe("REVIEW");
    expect(result.signals.find((signal) => signal.key === "gps_accuracy")?.state).toBe("FAIL");
  });

  it("treats high mock-location risk as critical but review-first by default", () => {
    const result = assessAttendanceTrust({
      source: "MOBILE_APP",
      insideGeofence: true,
      accuracyMeters: 10,
      mockLocationRisk: "HIGH",
    });

    expect(result.criticalRisk).toBe(true);
    expect(result.riskLevel).toBe("CRITICAL");
    expect(result.decision).toBe("REVIEW");
  });

  it("can hard-reject critical risk when a strict tenant policy is enabled", () => {
    const result = assessAttendanceTrust(
      {
        source: "MOBILE_APP",
        insideGeofence: true,
        accuracyMeters: 10,
        impossibleTravel: true,
      },
      { ...DEFAULT_ATTENDANCE_TRUST_POLICY, blockCriticalRisk: true },
    );

    expect(result.criticalRisk).toBe(true);
    expect(result.decision).toBe("REJECT");
  });

  it("requires face and liveness only when the versioned policy requests them", () => {
    const result = assessAttendanceTrust(
      {
        source: "MOBILE_APP",
        insideGeofence: true,
        accuracyMeters: 10,
        mockLocationRisk: "NONE",
      },
      {
        ...DEFAULT_ATTENDANCE_TRUST_POLICY,
        version: "trust-v1-face-required",
        requireFace: true,
        requireLiveness: true,
      },
    );

    expect(result.policyVersion).toBe("trust-v1-face-required");
    expect(result.criticalRisk).toBe(true);
    expect(result.decision).toBe("REVIEW");
    expect(result.signals.find((signal) => signal.key === "face_match")?.state).toBe("FAIL");
    expect(result.signals.find((signal) => signal.key === "liveness")?.state).toBe("FAIL");
  });

  it("allows a trusted kiosk to score cleanly without GPS accuracy", () => {
    const result = assessAttendanceTrust({
      source: "KIOSK",
      insideGeofence: true,
      deviceTrusted: true,
      mockLocationRisk: "UNKNOWN",
    });

    expect(result.score).toBe(100);
    expect(result.riskLevel).toBe("LOW");
    expect(result.decision).toBe("ACCEPT");
  });
});
