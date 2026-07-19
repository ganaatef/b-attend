/**
 * Load test script using autocannon.
 * Tests key endpoints for performance under concurrent traffic.
 *
 * Usage: npx tsx scripts/load-test.ts
 */
import autocannon from "autocannon";

const BASE_URL = process.env.TEST_URL || "https://b-attend.vercel.app";

const tests = [
  { name: "Homepage (static)", url: `${BASE_URL}/`, connections: 20, duration: 10 },
  { name: "Pricing (static)", url: `${BASE_URL}/pricing`, connections: 20, duration: 10 },
  { name: "Features (static)", url: `${BASE_URL}/features`, connections: 20, duration: 10 },
  { name: "Login page (static)", url: `${BASE_URL}/login`, connections: 20, duration: 10 },
  { name: "API: Public Plans", url: `${BASE_URL}/api/public/plans`, connections: 30, duration: 10 },
  { name: "Login redirect (protected)", url: `${BASE_URL}/dashboard`, connections: 20, duration: 10 },
];

async function run() {
  console.log(`\n🔥 B-Attend Load Test — ${BASE_URL}`);
  console.log(`${"═".repeat(60)}\n`);

  const results: Array<{ name: string; rps: number; latAvg: number; latP99: number; totalReqs: number; errors: number }> = [];

  for (const test of tests) {
    console.log(`▶ ${test.name} (${test.connections}c × ${test.duration}s)...`);

    const instance = autocannon({
      url: test.url,
      connections: test.connections,
      duration: test.duration,
      pipelining: 1,
      timeout: 10,
      // Follow redirects
      requestOptions: {
        maxRedirections: 3,
      },
    });

    const result = await new Promise<autocannon.Result>((resolve, reject) => {
      autocannon.track(instance, { renderProgressBar: false });
      instance.on("done", resolve);
      instance.on("error", reject);
    });

    const errors = (result.errors ?? 0) + (result.timeouts ?? 0);
    const rps = result.requests.average;
    const latAvg = result.latency.average;
    const latP99 = result.latency.p99;

    results.push({
      name: test.name,
      rps: Math.round(rps),
      latAvg: Math.round(latAvg),
      latP99: Math.round(latP99),
      totalReqs: result.requests.total,
      errors,
    });

    const status = errors === 0 ? "✅" : "⚠️";
    console.log(`  ${status} ${Math.round(rps)} req/s | avg: ${Math.round(latAvg)}ms | p99: ${Math.round(latP99)}ms | total: ${result.requests.total} | errors: ${errors}\n`);
  }

  // Summary table
  console.log(`\n${"═".repeat(60)}`);
  console.log("SUMMARY");
  console.log(`${"═".repeat(60)}`);
  console.log(`${"Endpoint".padEnd(30)} ${"RPS".padStart(8)} ${"Avg(ms)".padStart(10)} ${"P99(ms)".padStart(10)} ${"Errors".padStart(8)}`);
  console.log(`${"-".repeat(66)}`);

  let totalErrors = 0;
  for (const r of results) {
    console.log(
      `${r.name.padEnd(30)} ${String(r.rps).padStart(8)} ${String(r.latAvg).padStart(10)} ${String(r.latP99).padStart(10)} ${String(r.errors).padStart(8)}`
    );
    totalErrors += r.errors;
  }

  console.log(`${"-".repeat(66)}`);
  console.log(`Total errors: ${totalErrors}`);

  if (totalErrors === 0) {
    console.log("\n✅ All endpoints handled concurrent traffic with zero errors.");
  } else {
    console.log(`\n⚠️ ${totalErrors} error(s) detected — investigate before scaling.`);
  }
}

run().catch(console.error);
