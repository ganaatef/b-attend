import { describe, it, expect } from "vitest";
import { haversineMeters, isInsideGeofence } from "@/lib/attendance/engine";

describe("haversineMeters", () => {
  it("returns 0 for identical points", () => {
    expect(haversineMeters(30.0444, 31.2357, 30.0444, 31.2357)).toBe(0);
  });

  it("calculates distance between two known Cairo points", () => {
    const cairoTower = [30.0459, 31.2243];
    const tahrirSquare = [30.0444, 31.2357];
    const d = haversineMeters(cairoTower[0], cairoTower[1], tahrirSquare[0], tahrirSquare[1]);
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1400);
  });

  it("calculates distance for points ~1km apart", () => {
    const d = haversineMeters(30.0, 31.0, 30.009, 31.0);
    expect(d).toBeGreaterThan(900);
    expect(d).toBeLessThan(1100);
  });

  it("is symmetric", () => {
    const d1 = haversineMeters(30.0, 31.0, 30.01, 31.01);
    const d2 = haversineMeters(30.01, 31.01, 30.0, 31.0);
    expect(d1).toBe(d2);
  });
});

describe("isInsideGeofence", () => {
  it("returns true when distance equals radius", () => {
    expect(isInsideGeofence(150, 150)).toBe(true);
  });

  it("returns true when distance < radius", () => {
    expect(isInsideGeofence(50, 150)).toBe(true);
  });

  it("returns false when distance > radius", () => {
    expect(isInsideGeofence(200, 150)).toBe(false);
  });

  it("returns true when distance is 0", () => {
    expect(isInsideGeofence(0, 150)).toBe(true);
  });
});
