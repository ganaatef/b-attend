/**
 * Behavioral tests for /api/health and Next.js 16 proxy routing.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";

const dbMock = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { GET } from "@/app/api/health/route";

const TEST_SESSION_KEY = "test-session-key-for-ci-only-32-characters";
let proxyHandler: (req: NextRequest) => Promise<Response>;

async function signedCookie(payload: Record<string, unknown>): Promise<string> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(TEST_SESSION_KEY));
  return `battend_session=${token}`;
}

beforeAll(async () => {
  vi.stubEnv("SESSION_SECRET", TEST_SESSION_KEY);
  proxyHandler = (await import("@/proxy")).proxy;
});

describe("GET /api/health", () => {
  it("returns 200 when the database is reachable", async () => {
    dbMock.$queryRaw.mockResolvedValue([{ ok: 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("ok");
  });

  it("returns 503 without leaking dependency details", async () => {
    dbMock.$queryRaw.mockRejectedValue(new Error("database connection failed"));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = JSON.stringify(await res.json());
    expect(body).toContain("unavailable");
    expect(body).not.toMatch(/password|stack|database connection failed/i);
  });
});

describe("proxy routing", () => {
  it("allows /api/health without a browser session", async () => {
    const res = await proxyHandler(new NextRequest("http://localhost/api/health"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects an unauthenticated protected page to login", async () => {
    const res = await proxyHandler(new NextRequest("http://localhost/dashboard"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("redirects a tenant session away from the platform admin area", async () => {
    const cookie = await signedCookie({
      kind: "tenant",
      role: "BRANCH_MANAGER",
      tenantId: "tenant-1",
      sub: "user-1",
      name: "Manager",
      email: "manager@example.test",
    });
    const res = await proxyHandler(new NextRequest("http://localhost/admin", { headers: { cookie } }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("allows a platform admin session into /admin", async () => {
    const cookie = await signedCookie({
      kind: "platform",
      role: "SUPER_ADMIN",
      sub: "platform-1",
      name: "Admin",
      email: "admin@example.test",
    });
    const res = await proxyHandler(new NextRequest("http://localhost/admin", { headers: { cookie } }));
    expect(res.status).toBe(200);
  });
});
