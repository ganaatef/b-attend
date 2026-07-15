/**
 * Cross-platform post-build script.
 * Copies .next/static and public into .next/standalone for standalone deployment.
 */
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

if (!fs.existsSync(standalone)) {
  console.log("[postbuild] No standalone output found, skipping copy.");
  process.exit(0);
}

const tasks = [
  { src: path.join(root, ".next", "static"), dest: path.join(standalone, ".next", "static") },
  { src: path.join(root, "public"), dest: path.join(standalone, "public") },
];

for (const { src, dest } of tasks) {
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
    console.log(`[postbuild] Copied ${path.relative(root, src)} → ${path.relative(root, dest)}`);
  } else {
    console.warn(`[postbuild] Source not found, skipping: ${path.relative(root, src)}`);
  }
}

console.log("[postbuild] Done.");
