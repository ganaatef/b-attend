import { execFileSync } from "node:child_process";

const migrationsEnabled = process.env.RUN_PRISMA_MIGRATIONS === "true";

if (!migrationsEnabled) {
  console.log("[prisma] Production migrations are disabled for this build.");
  process.exit(0);
}

console.log("[prisma] Applying tracked production migrations before build.");
execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
});
