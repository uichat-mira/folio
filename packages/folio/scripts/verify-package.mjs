import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageManifest = JSON.parse(
  readFileSync(resolve(packageRoot, "package.json"), "utf8"),
);
const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const result = spawnSync(
  npmCommand,
  ["pack", "--dry-run", "--json", "--ignore-scripts"],
  {
    cwd: packageRoot,
    encoding: "utf8",
    shell: isWindows,
  },
);

if (result.error) {
  console.error(`Failed to start npm pack with ${npmCommand}:`);
  console.error(result.error);
  process.exit(1);
}

const stdout = result.stdout ?? "";
const stderr = result.stderr ?? "";

if (result.status !== 0) {
  process.stderr.write(
    stderr || stdout || `npm pack exited with status ${result.status ?? "unknown"}\n`,
  );
  process.exit(result.status ?? 1);
}

assert.ok(stdout.trim(), "npm pack returned no JSON output");

let reports;
try {
  reports = JSON.parse(stdout);
} catch (error) {
  console.error("npm pack returned invalid JSON:");
  console.error(stdout);
  throw error;
}

const report = reports.at(-1);
assert.ok(report, "npm pack returned no package report");
assert.equal(report.name, packageManifest.name);
assert.equal(report.version, packageManifest.version);

const files = new Set(report.files.map((file) => file.path));
const required = [
  "package.json",
  "README.md",
  "LICENSE",
  "dist/index.js",
  "dist/index.d.ts",
  "dist/vite.js",
  "dist/vite.d.ts",
  "dist/styles.css",
];

for (const path of required) {
  assert.ok(files.has(path), `npm package is missing ${path}`);
}

for (const path of files) {
  assert.ok(!path.startsWith("src/"), `source file leaked into package: ${path}`);
  assert.ok(!path.startsWith("test/"), `test file leaked into package: ${path}`);
}

console.log(
  `npm pack verified: ${report.filename}, ${report.entryCount} files, ${report.unpackedSize} bytes unpacked`,
);
