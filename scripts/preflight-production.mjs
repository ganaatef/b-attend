const failures = [];
const warnings = [];

function requireEnv(name, predicate = (value) => Boolean(value)) {
  const value = process.env[name];
  if (!predicate(value)) failures.push(`${name} is missing or invalid`);
  return value;
}

const databaseUrl = requireEnv("DATABASE_URL", (value) => /^postgres(?:ql)?:\/\//.test(value ?? ""));
requireEnv("DIRECT_URL", (value) => /^postgres(?:ql)?:\/\//.test(value ?? ""));
requireEnv("APP_URL", (value) => /^https:\/\//.test(value ?? ""));
requireEnv("SESSION_SECRET", (value) => Boolean(value && value.length >= 32 && !value.startsWith("dev-secret")));
requireEnv("EMAIL_FROM", (value) => Boolean(value && value.includes("@")));
requireEnv("SMTP_HOST");
requireEnv("SMTP_USER");
requireEnv("SMTP_PASS");
requireEnv("UPSTASH_REDIS_REST_URL", (value) => /^https:\/\//.test(value ?? ""));
requireEnv("UPSTASH_REDIS_REST_TOKEN");

const paymentProvider = String(process.env.PAYMENT_PROVIDER ?? "").toLowerCase();
if (!paymentProvider || paymentProvider === "manual") {
  failures.push("PAYMENT_PROVIDER must be a real provider for public paid subscriptions; manual mode is pilot-only");
}
if (process.env.MANUAL_ACTIVATION_MODE === "true") {
  failures.push("MANUAL_ACTIVATION_MODE=true is not allowed for public paid subscriptions");
}
if (paymentProvider && paymentProvider !== "manual") requireEnv("PAYMENT_WEBHOOK_SECRET");

if (process.env.DEMO_SEED_CONFIRM === "true") {
  failures.push("DEMO_SEED_CONFIRM=true must never be enabled in production");
}
if (!databaseUrl?.includes("sslmode=require")) {
  warnings.push("DATABASE_URL does not include sslmode=require; verify TLS is enforced by the provider");
}

console.log("B-Attend production preflight");
console.log("===============================");
if (failures.length === 0) console.log("PASS: required production configuration is present.");
else {
  console.error(`FAIL: ${failures.length} production requirement(s) not met.`);
  for (const failure of failures) console.error(`- ${failure}`);
}
for (const warning of warnings) console.warn(`WARN: ${warning}`);

if (failures.length > 0) process.exit(1);
