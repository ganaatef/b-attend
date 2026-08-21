import { PrismaClient, type Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function buildPrismaOptions() {
  const options: Prisma.PrismaClientOptions = {
    log: process.env.NODE_ENV === "production" ? ["error", "warn"] : ["query"],
  };

  if (process.env.NODE_ENV === "production") {
    const baseUrl = process.env.DATABASE_URL ?? "";
    const connectionLimit = Math.max(1, Math.min(100, Number(process.env.DB_CONNECTION_LIMIT ?? 10)));
    const poolTimeout = Math.max(1, Math.min(120, Number(process.env.DB_POOL_TIMEOUT_SEC ?? 10)));

    try {
      const url = new URL(baseUrl);
      url.searchParams.set("connection_limit", String(connectionLimit));
      url.searchParams.set("pool_timeout", String(poolTimeout));
      options.datasourceUrl = url.toString();
    } catch {
      // Prisma will produce the actionable configuration error for an invalid URL.
      options.datasourceUrl = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`;
    }
  }

  return options;
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient(buildPrismaOptions());

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
