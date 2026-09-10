import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const dbMock = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { GET } from "@/app/api/ready/route";

let proxyHandler: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  proxyHandler = (await import("@/proxy")).proxy;
});

beforeEach(() => {
  dbMock.$queryRaw.mockReset();
});

describe("GET /api/ready", () => {
  it("returns ready only when the required migration is complete and no migration is unresolved", async () => {
    dbMock.$queryRaw
      .mockResolvedValueOnce([{ finished_at: new Date(), rolled_back_at: null }])
      .mockResolvedValueOnce([{ count: 0 }]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ready" });
  });

  it("fails closed when the release-required migration is missing", async () => {
    dbMock.$queryRaw.mockResolvedValueOnce([]);

    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "unavailable" });
  });

  it("fails closed when a Prisma migration is unresolved", async () => {
    dbMock.$queryRaw
      .mockResolvedValueOnce([{ finished_at: new Date(), rolled_back_at: null }])
      .mockResolvedValueOnce([{ count: 1 }]);

    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "unavailable" });
  });

  it("does not expose database errors or migration identifiers", async () => {
    dbMock.$queryRaw.mockRejectedValueOnce(new Error("postgres password=secret migration failed"));

    const res = await GET();
    const body = JSON.stringify(await res.json());
    expect(res.status).toBe(503);
    expect(body).toBe('{"status":"unavailable"}');
    expect(body).not.toMatch(/postgres|password|migration|202609/i);
  });
});

describe("readiness proxy routing", () => {
  it("allows the safe readiness probe without a browser session", async () => {
    const res = await proxyHandler(new NextRequest("http://localhost/api/ready"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
