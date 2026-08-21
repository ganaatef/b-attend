/**
 * Load test script using autocannon.
 * Tests key endpoints for performance under concurrent traffic.
 *
 * Usage: npx tsx scripts/load-test.ts
 */
import autocannon from "autocannon";

const BASE_URL = process.env.TEST_URL || "https://b-attend.vercel.app";
const connections = Number(process.env.LOAD_TEST_CONNECTIONS ?? 50);
const duration = Number(process.env.LOAD_TEST_DURATION ?? 15);
const burstConnections = Number(process.env.LOAD_TEST_BURST_CONNECTIONS ?? 100);
const burstDuration = Number(process.env.LOAD_TEST_BURST_DURATION ?? 10);

const tests = [
  { name: "Homepage (static)", url: `${BASE_URL}/`, connections, duration, allowedStatuses: [200] },
  { name: "Pricing (static)", url: `${BASE_URL}/pricing`, connections, duration, allowedStatuses: [200] },
  { name: "API: Public Plans", url: `${BASE_URL}/api/public/plans`, connections, duration, allowedStatuses: [200] },
  { name: "Login redirect (protected)", url: `${BASE_URL}/dashboard`, connections, duration, allowedStatuses: [200, 301, 302, 307, 308] },
  { name: "Signup page", url: `${BASE_URL}/signup`, connections, duration, allowedStatuses: [200] },
  { name: `Rate limit burst (${burstConnections}c)`, url: `${BASE_URL}/api/public/plans`, connections: burstConnections, duration: burstDuration, allowedStatuses: [200] },
];

async function run() {
  console.log(`\n🔥 B-Attend Load Test — ${BASE_URL}`);
  console.log(`${"═".repeat(60)}\n`);

  const results: Array<{ name: string; rps: number; latAvg: number; latP99: number; totalReqs: number; errors: number; non2xx: number }> = [];

  for (const test of tests) {
    console.log(`▶ ${test.name} (${test.connections}c × ${test.duration}s)...`);

    const instance = autocannon({
      url: test.url,
      connections: test.connections,
      duration: test.duration,
      pipelining: 1,
      timeout: 10,
      headers: process.env.LOAD_TEST_TOKEN ? { "x-load-test-token": process.env.LOAD_TEST_TOKEN } : undefined,
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

    const non2xx = result.non2xx ?? 0;
    const unexpectedStatuses = Object.entries(result.statusCodeStats ?? {})
      .filter(([status]) => !test.allowedStatuses.includes(Number(status)))
      .reduce((sum, [, stats]) => sum + Number(stats.count), 0);
    const errors = (result.errors ?? 0) + (result.timeouts ?? 0) + unexpectedStatuses;
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
      non2xx,
    });

    const status = errors === 0 ? "✅" : "⚠️";
    const statusSummary = Object.entries(result.statusCodeStats ?? {}).map(([code, stats]) => `${code}:${stats.count}`).join(", ");
    console.log(`  ${status} ${Math.round(rps)} req/s | avg: ${Math.round(latAvg)}ms | p99: ${Math.round(latP99)}ms | total: ${result.requests.total} | statuses: ${statusSummary} | unexpected: ${unexpectedStatuses} | errors: ${errors}\n`);
  }

  // Summary table
  console.log(`\n${"═".repeat(60)}`);
  console.log("SUMMARY");
  console.log(`${"═".repeat(60)}`);
  console.log(`${"Endpoint".padEnd(30)} ${"RPS".padStart(8)} ${"Avg(ms)".padStart(10)} ${"P99(ms)".padStart(10)} ${"Non2xx".padStart(8)} ${"Errors".padStart(8)}`);
  console.log(`${"-".repeat(66)}`);

  let totalErrors = 0;
  for (const r of results) {
    console.log(
      `${r.name.padEnd(30)} ${String(r.rps).padStart(8)} ${String(r.latAvg).padStart(10)} ${String(r.latP99).padStart(10)} ${String(r.non2xx).padStart(8)} ${String(r.errors).padStart(8)}`
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
