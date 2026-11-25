import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

const CLI = resolve(import.meta.dirname, "../bin/create-folio.mjs");

function run(cwd, ...args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" });
}
test("npx initializer creates a Folio site without installing or touching its parent", () => {
  const root = mkdtempSync(resolve(tmpdir(), "folio-create-test-"));
  try {
    const result = run(root, "my-folio");
    assert.equal(result.status, 0, result.stderr);
    const project = resolve(root, "my-folio");
    const pkg = JSON.parse(readFileSync(resolve(project, "package.json"), "utf8"));
    assert.equal(pkg.name, "my-folio");
    assert.equal(pkg.dependencies["@uichat-mira/folio"], "^0.2.0");
    for (const file of ["index.html", "folio.config.ts", "vite.config.ts",
      "src/main.tsx", "content/hello.md", ".gitignore", "tsconfig.json"]) {
      assert.ok(existsSync(resolve(project, file)), file + " should be included in package");
    }
    assert.ok(!existsSync(resolve(project, "node_modules")), "install must be opt-in");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("initializer refuses existing paths, escape attempts and unknown options", () => {
  const root = mkdtempSync(resolve(tmpdir(), "folio-create-test-"));
  try {
    mkdirSync(resolve(root, "already"));
    writeFileSync(resolve(root, "already", "keep.txt"), "keep");
    for (const args of [["already"], ["../outside"], [".."], ["/tmp/ab"], ["name", "--erase"], []]) {
      const result = run(root, ...args);
      assert.notEqual(result.status, 0, "must reject " + args.join(" "));
    }
    assert.equal(readFileSync(resolve(root, "already", "keep.txt"), "utf8"), "keep");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("npx-style symlinked executable actually runs the entrypoint", () => {
  const root = mkdtempSync(resolve(tmpdir(), "folio-create-test-"));
  try {
    const command = resolve(root, "create-folio");
    symlinkSync(CLI, command);
    const result = spawnSync(process.execPath, [command, "via-npx"], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(resolve(root, "via-npx", ".gitignore")));
    assert.match(result.stdout, /Folio site created/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("initializer exposes help without writing a project", () => {
  const root = mkdtempSync(resolve(tmpdir(), "folio-create-test-"));
  try {
    const result = run(root, "--help");
    assert.equal(result.status, 0);
    assert.match(result.stdout, /npx @uichat-mira\/create-folio/);
    assert.ok(!existsSync(resolve(root, ".folio-init-")));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
