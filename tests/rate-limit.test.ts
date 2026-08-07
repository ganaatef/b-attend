import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  const ip = "192.168.1.1";

  it("allows requests within limit", () => {
    const result = checkRateLimit(ip, "/api/something", 10, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("blocks requests exceeding limit", () => {
    const ip2 = "192.168.1.2";
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip2, "/api/something", 10, 60_000);
    }
    const result = checkRateLimit(ip2, "/api/something", 10, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("classifies auth routes correctly", () => {
    const result = checkRateLimit("10.0.0.1", "/api/auth/login", 10, 60_000);
    expect(result.allowed).toBe(true);
  });

  it("classifies general routes correctly", () => {
    const result = checkRateLimit("10.0.0.2", "/dashboard", 120, 60_000);
    expect(result.allowed).toBe(true);
  });

  it("different IPs have separate buckets", () => {
    const r1 = checkRateLimit("10.0.0.3", "/api/test", 5, 60_000);
    const r2 = checkRateLimit("10.0.0.4", "/api/test", 5, 60_000);
    expect(r1.remaining).toBe(4);
    expect(r2.remaining).toBe(4);
  });

  it("different categories have separate buckets", () => {
    const ip3 = "10.0.0.5";
    checkRateLimit(ip3, "/api/test", 2, 60_000);
    checkRateLimit(ip3, "/api/test", 2, 60_000);
    const authResult = checkRateLimit(ip3, "/api/auth/login", 10, 60_000);
    expect(authResult.allowed).toBe(true);
  });
});

describe("getRateLimitHeaders", () => {
  it("returns correct headers", () => {
    const headers = getRateLimitHeaders(60, 55, 0);
    expect(headers["X-RateLimit-Limit"]).toBe("60");
    expect(headers["X-RateLimit-Remaining"]).toBe("55");
    expect(headers["Retry-After"]).toBeUndefined();
  });

  it("includes Retry-After when blocked", () => {
    const headers = getRateLimitHeaders(60, 0, 30_000);
    expect(headers["Retry-After"]).toBe("30");
  });

  it("floors remaining to 0 when negative", () => {
    const headers = getRateLimitHeaders(60, -5, 0);
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
  });
});

describe("RATE_LIMITS constants", () => {
  it("has correct values", () => {
    expect(RATE_LIMITS.general).toBe(120);
    expect(RATE_LIMITS.api).toBe(60);
    expect(RATE_LIMITS.auth).toBe(10);
    expect(RATE_LIMITS.kiosk).toBe(30);
  });
});
