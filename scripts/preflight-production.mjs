const failures = [];
const warnings = [];

function requireEnv(name, predicate = (value) => Boolean(value)) {
  const value = process.env[name];
  if (!predicate(value)) failures.push(`${name} is missing or invalid`);
  return value;
}

function isPostgres(value) {
  return /^postgres(?:ql)?:\/\//i.test(value ?? "");
}

const databaseUrl = requireEnv("DATABASE_URL", isPostgres);
requireEnv("DIRECT_URL", isPostgres);
requireEnv("APP_URL", (value) => /^https:\/\//i.test(value ?? ""));
requireEnv("SESSION_SECRET", (value) => Boolean(value && value.length >= 32 && !value.startsWith("dev-secret")));
requireEnv("UPSTASH_REDIS_REST_URL", (value) => /^https:\/\//i.test(value ?? ""));
requireEnv("UPSTASH_REDIS_REST_TOKEN");

const emailProvider = String(process.env.EMAIL_PROVIDER ?? "").toLowerCase();
requireEnv("EMAIL_FROM", (value) => Boolean(value && value.includes("@")));
if (emailProvider !== "resend") {
  failures.push("EMAIL_PROVIDER must be 'resend' for production account invitations and security email");
} else {
  requireEnv("RESEND_API_KEY");
}

const billingMode = String(process.env.BILLING_MODE ?? "sales_assisted").toLowerCase();
const paymentProvider = String(process.env.PAYMENT_PROVIDER ?? "manual").toLowerCase();
if (!["sales_assisted", "self_service"].includes(billingMode)) {
  failures.push("BILLING_MODE must be 'sales_assisted' or 'self_service'");
}
if (billingMode === "self_service") {
  if (!paymentProvider || paymentProvider === "manual") {
    failures.push("Self-service billing requires a real PAYMENT_PROVIDER");
  }
  requireEnv("PAYMENT_WEBHOOK_SECRET", (value) => Boolean(value && value.length >= 24));
} else if (paymentProvider === "manual") {
  warnings.push("Sales-assisted billing is using manual payment confirmation; this is valid, but public card checkout is disabled");
}

if (process.env.DEMO_SEED_CONFIRM === "true") {
  failures.push("DEMO_SEED_CONFIRM=true must never be enabled in production");
}
if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
  failures.push("NEXT_PUBLIC_DEMO_MODE=true must never be enabled on the public production application");
}
if (!databaseUrl?.includes("sslmode=require") && !databaseUrl?.includes("sslmode=verify-full")) {
  warnings.push("DATABASE_URL does not explicitly require TLS; verify transport encryption is enforced by the provider");
}
if (process.env.RUN_PRISMA_MIGRATIONS !== "true") {
  warnings.push("RUN_PRISMA_MIGRATIONS is not true; tracked migrations must be deployed by a separate release step before serving new code");
}

const connectionLimit = Number.parseInt(process.env.DB_CONNECTION_LIMIT ?? "10", 10);
if (!Number.isInteger(connectionLimit) || connectionLimit < 1 || connectionLimit > 100) {
  failures.push("DB_CONNECTION_LIMIT must be an integer between 1 and 100");
}
const poolTimeout = Number.parseInt(process.env.DB_POOL_TIMEOUT_SEC ?? "10", 10);
if (!Number.isInteger(poolTimeout) || poolTimeout < 1 || poolTimeout > 120) {
  failures.push("DB_POOL_TIMEOUT_SEC must be an integer between 1 and 120");
}

console.log("B-Attend production preflight");
console.log("===============================");
console.log(`Billing mode: ${billingMode || "<missing>"}`);
console.log(`Payment provider: ${paymentProvider || "<missing>"}`);
console.log(`Email provider: ${emailProvider || "<missing>"}`);

if (failures.length === 0) console.log("PASS: required production configuration is present.");
else {
  console.error(`FAIL: ${failures.length} production requirement(s) not met.`);
  for (const failure of failures) console.error(`- ${failure}`);
}
for (const warning of warnings) console.warn(`WARN: ${warning}`);

if (failures.length > 0) process.exit(1);
