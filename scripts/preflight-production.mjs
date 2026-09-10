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

function isBooleanString(value) {
  return /^(?:true|false|1|0|yes|no|on|off)$/i.test(value ?? "");
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
  // Paymob is the only provider for which the current production contract has
  // explicit credentials and HMAC/webhook verification fields. Refuse to call
  // another provider "ready" until its adapter and secret contract exist.
  if (paymentProvider !== "paymob") {
    failures.push("Self-service production billing currently requires PAYMENT_PROVIDER='paymob'");
  }
  requireEnv("PAYMENT_WEBHOOK_SECRET", (value) => Boolean(value && value.length >= 24));
  requireEnv("PAYMOB_API_KEY", (value) => Boolean(value && value.length >= 16));
  requireEnv("PAYMOB_INTEGRATION_ID", (value) => /^\d+$/.test(value ?? ""));
  requireEnv("PAYMOB_HMAC_SECRET", (value) => Boolean(value && value.length >= 24));
} else if (paymentProvider === "manual") {
  warnings.push("Sales-assisted billing is using manual payment confirmation; this is valid, but public card checkout is disabled");
} else if (paymentProvider !== "paymob") {
  warnings.push(`PAYMENT_PROVIDER='${paymentProvider || "<missing>"}' is not an active production adapter in the current release`);
}

const attendanceVerificationProvider = String(process.env.ATTENDANCE_VERIFICATION_PROVIDER ?? "none")
  .trim()
  .toLowerCase();
if (!["none", "google_play_integrity"].includes(attendanceVerificationProvider)) {
  failures.push(
    `ATTENDANCE_VERIFICATION_PROVIDER='${attendanceVerificationProvider || "<missing>"}' is not an active production adapter`,
  );
}

if (attendanceVerificationProvider === "google_play_integrity") {
  requireEnv(
    "GOOGLE_PLAY_INTEGRITY_PACKAGE_NAME",
    (value) => /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(value ?? ""),
  );

  const serviceAccountJson = requireEnv("GOOGLE_PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON");
  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson);
      if (!parsed || typeof parsed !== "object" || !parsed.client_email || !parsed.private_key) {
        failures.push(
          "GOOGLE_PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON must contain client_email and private_key",
        );
      }
    } catch {
      failures.push("GOOGLE_PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON must be valid JSON");
    }
  }

  requireEnv(
    "GOOGLE_PLAY_INTEGRITY_CERT_SHA256",
    (value) => Boolean(value && value.split(",").map((item) => item.trim()).filter(Boolean).length > 0),
  );
  requireEnv("GOOGLE_PLAY_INTEGRITY_REQUIRE_LICENSED", isBooleanString);
  requireEnv("GOOGLE_PLAY_INTEGRITY_REQUIRE_STRONG", isBooleanString);
  requireEnv(
    "GOOGLE_PLAY_INTEGRITY_MAX_TOKEN_AGE_MS",
    (value) => {
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) && parsed >= 60_000 && parsed <= 900_000;
    },
  );
} else {
  warnings.push(
    "Attendance verification provider is disabled; device-integrity requirements must remain disabled until a real provider is configured",
  );
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
console.log(`Attendance verification provider: ${attendanceVerificationProvider || "<missing>"}`);

if (failures.length === 0) console.log("PASS: required production configuration is present.");
else {
  console.error(`FAIL: ${failures.length} production requirement(s) not met.`);
  for (const failure of failures) console.error(`- ${failure}`);
}
for (const warning of warnings) console.warn(`WARN: ${warning}`);

if (failures.length > 0) process.exit(1);
