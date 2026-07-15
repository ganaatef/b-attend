import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const rows = await db.$queryRawUnsafe<{ name: string; type: string }[]>("PRAGMA table_info(PlatformUser);");
console.log("PlatformUser columns:");
for (const r of rows) console.log(`  - ${r.name} (${r.type})`);

console.log("\nNow trying findUnique...");
try {
  const u = await db.platformUser.findUnique({ where: { email: "super@b-attend.app" } });
  console.log("OK:", u?.email, u?.role);
} catch (e: any) {
  console.error("FAIL:", e?.message);
}
await db.$disconnect();
