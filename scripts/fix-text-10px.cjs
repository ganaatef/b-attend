const fs = require("fs");
const path = require("path");

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist") continue;
      files.push(...walk(full));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const srcDir = path.resolve(__dirname, "../src");
const files = walk(srcDir);
let totalFixed = 0;

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  if (!content.includes("text-[10px]")) continue;
  const newContent = content.replace(/text-\[10px\]/g, "text-xs");
  const count = (content.match(/text-\[10px\]/g) || []).length;
  fs.writeFileSync(file, newContent, "utf8");
  console.log(`Fixed ${count} in ${path.relative(process.cwd(), file)}`);
  totalFixed += count;
}

console.log(`\nTotal: ${totalFixed} replacements across ${files.filter(f => fs.readFileSync(f, "utf8").includes("text-xs")).length} files`);
