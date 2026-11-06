#!/usr/bin/env node
// FOL-019 scenario wrapper around the existing FOL-014 browser harness.
//
// The harness itself (docs/research/fol-014/run.mjs) stays the only browser
// driver: it builds the package, packs the real tarball, installs it into a
// consumer outside the repository, runs the strict tsc projects, builds the
// default UI and drives headless Chrome. This file only points that run at the
// FOL-019 fixture/results and at the scenario file that opts into the extra
// search and no-JS static phases. With no scenario it would reproduce the
// FOL-014 defaults; the FOL-019 invocation never writes fol-014/results.
//
// Usage: node docs/research/fol-019/run.mjs [--keep]
// Requires Chrome/Edge; set FOLIO014_CHROME to override the search.
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..", "..");
const harness = join(repoRoot, "docs", "research", "fol-014", "run.mjs");

const args = [
  harness,
  "--out",
  join(scriptDir, "results"),
  "--fixture",
  join(scriptDir, "consumer"),
  "--scenario",
  join(scriptDir, "scenario.json"),
  ...process.argv.slice(2),
];

console.log("FOL-019 baseline: FOL-014 harness with the fol-019 scenario");
console.log(`  harness:  ${harness}`);
console.log(`  fixture:  ${join(scriptDir, "consumer")}`);
console.log(`  results:  ${join(scriptDir, "results")}`);
console.log("");

const result = spawnSync(process.execPath, args, {
  cwd: repoRoot,
  stdio: "inherit",
  timeout: 1_800_000,
});

if (result.error) {
  console.error(`[wrapper] ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(`[wrapper] harness exited with code ${result.status}`);
  process.exit(result.status ?? 1);
}

console.log("");
console.log("FOL-019 baseline finished. Evidence:");
console.log(`  raw data:    ${join(scriptDir, "results", "acceptance.json")}`);
console.log(`  screenshots: ${join(scriptDir, "results", "screenshots")}`);
console.log(`  report:      docs/research/fol-019-default-ui-baseline.md`);
