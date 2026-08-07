import { describe, it, expect } from "vitest";

/**
 * Session security tests.
 *
 * Verifies the session module's structural security properties
 * without requiring a running server or cookies.
 */

describe("Session security", () => {
  it("session.ts uses HS256 algorithm", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/auth/session.ts"),
      "utf-8"
    );
    expect(content).toContain("HS256");
  });

  it("session.ts sets httpOnly cookie", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/auth/session.ts"),
      "utf-8"
    );
    expect(content).toContain("httpOnly: true");
  });

  it("session.ts sets secure flag in production", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/auth/session.ts"),
      "utf-8"
    );
    expect(content).toContain('secure: process.env.NODE_ENV === "production"');
  });

  it("session.ts sets sameSite: lax", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/auth/session.ts"),
      "utf-8"
    );
    expect(content).toContain('sameSite: "lax"');
  });

  it("session.ts uses sessionVersion for invalidation", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/auth/session.ts"),
      "utf-8"
    );
    expect(content).toContain("sessionVersion");
    expect(content).toContain("SESSION_VERSION = 1");
  });

  it("password-reset.ts uses SHA-256 for token hashing", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/auth/password-reset.ts"),
      "utf-8"
    );
    expect(content).toContain("sha256");
    expect(content).toContain("crypto.createHash");
  });

  it("password-reset.ts tokens expire after 1 hour", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/auth/password-reset.ts"),
      "utf-8"
    );
    expect(content).toContain("60 * 60 * 1000");
  });

  it("middleware.ts has no hardcoded JWT secret", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/middleware.ts"),
      "utf-8"
    );
    // Should NOT contain hardcoded secrets like "secret123"
    expect(content).not.toMatch(/secret123|hardcoded.*secret|my.*secret/i);
  });

  it("change-password route is accessible", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/middleware.ts"),
      "utf-8"
    );
    expect(content).toContain("change-password");
  });
});
