import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildPrismaOptions() {
  const options: { log: ("error" | "warn" | "query")[]; datasourceUrl?: string } = {
    log: process.env.NODE_ENV === "production" ? ["error", "warn"] : ["query"],
  };

  if (process.env.NODE_ENV === "production") {
    const baseUrl = process.env.DATABASE_URL ?? "";
    if (baseUrl) {
      const connectionLimit = positiveInt(process.env.DB_CONNECTION_LIMIT, 10);
      const poolTimeout = positiveInt(process.env.DB_POOL_TIMEOUT_SEC, 10);
      const url = new URL(baseUrl);
      if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", String(connectionLimit));
      if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", String(poolTimeout));
      options.datasourceUrl = url.toString();
    }
  }

  return options;
}

export const db = globalForPrisma.prisma ?? new PrismaClient(buildPrismaOptions());

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
