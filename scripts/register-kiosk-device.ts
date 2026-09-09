/**
 * Kiosk device provisioning — register a device and print its one-time secret.
 *
 *   npx tsx scripts/register-kiosk-device.ts \
 *     --company <tenantId> --branch <branchId> --name "Reception Kiosk" \
 *     [--identifier kiosk-reception-01] [--created-by <userId>]
 *
 * The raw device secret is printed EXACTLY ONCE. Store only the hash
 * (secretHash) in KioskDevice. Write the identifier + secret down securely —
 * after this run they cannot be recovered from the database.
 *
 * Example kiosk URL after provisioning:
 *   /kiosk?device=<deviceIdentifier>
 */

import { parseArgs } from "util";
import { activateKioskDevice } from "../src/lib/kiosk/kiosk-auth";

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      company: { type: "string" },
      branch: { type: "string" },
      name: { type: "string" },
      identifier: { type: "string" },
      "created-by": { type: "string" },
    },
  });

  if (!values.company || !values.branch || !values.name) {
    console.error(
      "Usage: npx tsx scripts/register-kiosk-device.ts --company <tenantId> --branch <branchId> --name \"<label>\" [--identifier <id>] [--created-by <userId>]"
    );
    process.exit(1);
  }

  const device = await activateKioskDevice({
    tenantId: values.company,
    branchId: values.branch,
    name: values.name,
    deviceIdentifier: values.identifier,
    createdById: values["created-by"],
  });

  console.log("=== Kiosk device activated ===");
  console.log(`deviceId:       ${device.deviceId}`);
  console.log(`deviceIdentifier: ${device.deviceIdentifier}`);
  console.log(`deviceSecret:   ${device.deviceSecret}`);
  console.log("");
  console.log("This secret is shown once and will not be recoverable later.");
}

main().catch((e) => {
  console.error("Provisioning failed:", e);
  process.exit(1);
});
