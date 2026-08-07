import { describe, it, expect } from "vitest";
import { getFieldSensitivity, SENSITIVE_FIELDS } from "@/lib/sensitive-data";

describe("getFieldSensitivity", () => {
  it("returns HIGH for nationalId", () => {
    expect(getFieldSensitivity("nationalId")).toBe("HIGH");
  });

  it("returns HIGH for bankAccount", () => {
    expect(getFieldSensitivity("bankAccount")).toBe("HIGH");
  });

  it("returns HIGH for salary", () => {
    expect(getFieldSensitivity("salary")).toBe("HIGH");
  });

  it("returns HIGH for walletNumber", () => {
    expect(getFieldSensitivity("walletNumber")).toBe("HIGH");
  });

  it("returns MEDIUM for phone", () => {
    expect(getFieldSensitivity("phone")).toBe("MEDIUM");
  });

  it("returns MEDIUM for email", () => {
    expect(getFieldSensitivity("email")).toBe("MEDIUM");
  });

  it("returns MEDIUM for address", () => {
    expect(getFieldSensitivity("address")).toBe("MEDIUM");
  });

  it("returns MEDIUM for emergencyContact", () => {
    expect(getFieldSensitivity("emergencyContact")).toBe("MEDIUM");
  });

  it("returns LOW for fullName", () => {
    expect(getFieldSensitivity("fullName")).toBe("LOW");
  });

  it("returns LOW for unknown fields", () => {
    expect(getFieldSensitivity("randomField")).toBe("LOW");
  });
});

describe("SENSITIVE_FIELDS", () => {
  it("HIGH has nationalId, bankAccount, walletNumber, salary", () => {
    expect(SENSITIVE_FIELDS.HIGH).toContain("nationalId");
    expect(SENSITIVE_FIELDS.HIGH).toContain("bankAccount");
    expect(SENSITIVE_FIELDS.HIGH).toContain("walletNumber");
    expect(SENSITIVE_FIELDS.HIGH).toContain("salary");
  });

  it("MEDIUM has phone, email, address, emergencyContact", () => {
    expect(SENSITIVE_FIELDS.MEDIUM).toContain("phone");
    expect(SENSITIVE_FIELDS.MEDIUM).toContain("email");
    expect(SENSITIVE_FIELDS.MEDIUM).toContain("address");
    expect(SENSITIVE_FIELDS.MEDIUM).toContain("emergencyContact");
  });
});
