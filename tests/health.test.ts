/**
 * Behavioral tests — /api/health endpoint + middleware safety.
 *
 * - /api/health returns 200 on healthy DB, 503 on dependency failure,
 *   never leaking internals, and bypasses the login redirect.
 * - The middleware still protects every other route, and /admin stays
 *   platform-only (tenant sessions are redirected away).
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";

const dbMock = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { GET } from "@/app/api/health/route";

const SECRET = "battend-test-secret-1234567890-abcdefgh";

let middleware: (req: NextRequest) => Promise<Response>;

async function signedCookie(payload: Record<string, unknown>): Promise<string> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(SECRET));
  return `battend_session=${token}`;
}

beforeAll(async () => {
  vi.stubEnv("SESSION_SECRET", SECRET);
  middleware = (await import("@/middleware")).middleware;
});

describe("GET /api/health", () => {
  it("returns 200 with status ok when the DB is reachable", async () => {
    dbMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("returns 503 without internals when the DB is unreachable", async () => {
    dbMock.$queryRaw.mockRejectedValue(new Error("connection refused: postgres://user:secret@host/db"));

    const res = await GET();
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.status).toBe("unavailable");
    expect(JSON.stringify(body)).not.toMatch(/postgres|secret|host|stack|connection refused/);
  });

  it("never exposes connection strings, versions, or stack traces on success", async () => {
    dbMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const res = await GET();
    const body = JSON.stringify(await res.json());

    expect(body).not.toMatch(/connectionString|DATABASE_URL|password|stack/i);
  });
});

describe("middleware — health endpoint bypass", () => {
  it("allows /api/health without a session (no login redirect)", async () => {
    const req = new NextRequest("http://localhost/api/health");

    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("still redirects unauthenticated users on protected routes", async () => {
    const req = new NextRequest("http://localhost/dashboard");

    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
  });
});

describe("middleware — /admin platform gating", () => {
  it("redirects a tenant session away from /admin", async () => {
    const cookie = await signedCookie({
      kind: "tenant",
      role: "BRANCH_MANAGER",
      tenantId: "tenant-1",
      sub: "user-1",
      name: "Manager",
      email: "m@test.com",
    });
    const req = new NextRequest("http://localhost/admin", { headers: { cookie } });

    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/");
  });

  it("allows a platform SUPER_ADMIN session into /admin", async () => {
    const cookie = await signedCookie({
      kind: "platform",
      role: "SUPER_ADMIN",
      sub: "platform-1",
      name: "Admin",
      email: "admin@platform.test",
    });
    const req = new NextRequest("http://localhost/admin", { headers: { cookie } });

    const res = await middleware(req);
    expect(res.status).toBe(200);
  });
});
