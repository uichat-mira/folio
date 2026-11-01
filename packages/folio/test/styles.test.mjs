// FOL-020 (Issue #111): the aggregated stylesheet must stay equivalent to its
// ordered sources, and the content gate must actually reject the regressions it
// claims to catch. These tests run against the built `dist/styles.css` (the
// workspace `npm test` builds first), plus synthetic multi-source manifests and
// mutated copies of the real stylesheet.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { aggregateStyles } from "../scripts/build-styles.mjs";
import { verifyStylesheet } from "../scripts/verify-styles.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stylesheetPath = join(packageRoot, "dist", "styles.css");
const sourcePath = join(packageRoot, "src", "styles.css");
const stylesheet = readFileSync(stylesheetPath, "utf8");

function withTempDir(run) {
  const directory = mkdtempSync(join(tmpdir(), "folio-styles-test-"));
  try {
    return run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function failureIds(css, directory) {
  const file = join(directory, "mutated.css");
  writeFileSync(file, css);
  return verifyStylesheet({ file }).failures.map((failure) => failure.id);
}

test("dist/styles.css is byte-identical to the single registered source", () => {
  const source = readFileSync(sourcePath, "utf8");
  assert.ok(source.length > 10_000, "src/styles.css is unexpectedly small");
  assert.equal(
    stylesheet,
    source,
    "with one manifest source, dist/styles.css must be byte-identical to src/styles.css",
  );
});

test("aggregation is deterministic and preserves the manifest order", () =>
  withTempDir((directory) => {
    writeFileSync(join(directory, "tokens.css"), "/* a */\n.a { color: red; }\n");
    writeFileSync(join(directory, "components.css"), "/* b */\n.b { color: blue; }\n");

    const forward = aggregateStyles({
      packageRoot: directory,
      sources: ["tokens.css", "components.css"],
    });
    const backward = aggregateStyles({
      packageRoot: directory,
      sources: ["components.css", "tokens.css"],
    });

    assert.ok(
      forward.css.indexOf(".a {") < forward.css.indexOf(".b {"),
      "the first manifest source must be concatenated first",
    );
    assert.ok(
      backward.css.indexOf(".b {") < backward.css.indexOf(".a {"),
      "swapping the manifest order must swap the output order",
    );
    assert.ok(
      forward.css.includes("}\n\n/* b */"),
      "multi-source output must join sources with exactly one blank line",
    );
    assert.equal(
      forward.css,
      aggregateStyles({
        packageRoot: directory,
        sources: ["tokens.css", "components.css"],
      }).css,
      "aggregation must be deterministic for the same inputs",
    );

    assert.throws(
      () => aggregateStyles({ packageRoot: directory, sources: [] }),
      /at least one package-relative CSS source/,
    );
    assert.throws(
      () =>
        aggregateStyles({
          packageRoot: directory,
          sources: ["tokens.css", "tokens.css"],
        }),
      /duplicate source/,
    );
    assert.throws(
      () => aggregateStyles({ packageRoot: directory, sources: ["missing.css"] }),
      /could not be read/,
    );
  }));

test("the built stylesheet passes the content gate", () => {
  const report = verifyStylesheet({ packageRoot });
  assert.deepEqual(report.failures, [], "dist/styles.css must pass every content check");
  assert.equal(report.bytes, Buffer.byteLength(stylesheet));
  assert.deepEqual(report.sources, ["src/styles.css"]);
});

test("deleting a canonical component rule fails the gate", () =>
  withTempDir((directory) => {
    const mutated = stylesheet.replace(/\.folio-docs-shell \{[^}]*\}/, "");
    assert.notEqual(mutated, stylesheet, "the negative mutation must change the stylesheet");
    assert.ok(
      failureIds(mutated, directory).includes("selectors:docs-shell"),
      "removing the .folio-docs-shell rule must be reported by selectors:docs-shell",
    );
  }));

test("deleting a component rule fails the gate", () =>
  withTempDir((directory) => {
    const mutated = stylesheet.replace(/\.folio-markdown \{[^}]*\}/, "");
    assert.notEqual(mutated, stylesheet, "the negative mutation must change the stylesheet");
    assert.ok(
      failureIds(mutated, directory).includes("selectors:markdown"),
      "removing the .folio-markdown rule must be reported by selectors:markdown",
    );
  }));

test("reordering or removing a token fails the gate", () =>
  withTempDir((directory) => {
    const reordered = stylesheet
      .replace("--folio-primary: #cc785c;", "@@swap@@")
      .replace("--folio-ink: #141413;", "--folio-primary: #cc785c;")
      .replace("@@swap@@", "--folio-ink: #141413;");
    assert.notEqual(reordered, stylesheet, "the token swap must change the stylesheet");
    assert.ok(
      failureIds(reordered, directory).includes("tokens:root"),
      "reordering :root tokens must be reported by tokens:root",
    );

    const removed = stylesheet.replace("--folio-hairline-soft: #ebe6df;", "");
    assert.notEqual(removed, stylesheet, "the token removal must change the stylesheet");
    assert.ok(
      failureIds(removed, directory).includes("tokens:root"),
      "removing a :root token must be reported by tokens:root",
    );
  }));

test("deleting a global rule fails the gate", () =>
  withTempDir((directory) => {
    const mutated = stylesheet.replace("* { box-sizing: border-box; }", "");
    assert.notEqual(mutated, stylesheet, "the negative mutation must change the stylesheet");
    assert.ok(
      failureIds(mutated, directory).includes("globals"),
      "removing the global box-sizing rule must be reported by globals",
    );
  }));

test("moving a component block out of cascade order fails the gate", () =>
  withTempDir((directory) => {
    const block = stylesheet.match(/\.folio-markdown \{[^}]*\}/);
    assert.ok(block, "the stylesheet must contain the .folio-markdown rule");
    const mutated = stylesheet.replace(block[0], "") + `\n${block[0]}\n`;
    assert.ok(
      failureIds(mutated, directory).includes("order:cascade"),
      "moving .folio-markdown after the later families must be reported by order:cascade",
    );
  }));

test("a truncated stylesheet fails the gate", () =>
  withTempDir((directory) => {
    const mutated = stylesheet.replace(/\}\s*$/, "\n");
    assert.ok(
      failureIds(mutated, directory).includes("parse"),
      "dropping the final closing brace must be reported by parse",
    );
  }));

test("the gate CLI exits non-zero for a mutated stylesheet", () =>
  withTempDir((directory) => {
    const mutatedPath = join(directory, "mutated.css");
    writeFileSync(mutatedPath, stylesheet.replace(/\.folio-markdown \{[^}]*\}/, ""));
    const result = spawnSync(
      process.execPath,
      [join(packageRoot, "scripts", "verify-styles.mjs"), "--file", mutatedPath],
      { encoding: "utf8", timeout: 300_000 },
    );
    assert.notEqual(result.status, 0, "the gate must exit non-zero");
    assert.match(
      result.stderr,
      /\[selectors:markdown\] FAIL/,
      "the gate must name the broken invariant on stderr",
    );
  }));
