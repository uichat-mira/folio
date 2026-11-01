import assert from "node:assert/strict";
import test from "node:test";

import {
  ALLOWED_DEPENDENCIES,
  detectLayerViolations,
  layerOf,
  runLayerSelfTest,
} from "../scripts/dependency-layers.mjs";

// FOL-031 (Issue #130): Core/UI/Build are one-way layers. The detector in
// scripts/dependency-layers.mjs reads real relative import/re-export edges, so
// these assertions fail on a reverse dependency instead of on a missing
// directory. `npm run layers:selftest` runs the same synthetic cases from a CLI.
const report = detectLayerViolations({});

test("every source module is assigned to a layer", () => {
  assert.deepEqual(
    report.unclassified,
    [],
    "a source module outside the layer map would silently escape the dependency gate",
  );
  assert.ok(report.modules.length >= 19, `expected the real source tree, found ${report.modules.length} modules`);
});

test("Core, UI and Build dependencies stay one-way", () => {
  assert.deepEqual(
    report.violations.map((violation) => `[${violation.id}] ${violation.message}`),
    [],
    "the layer gate found a reverse dependency",
  );
});

test("the gate scans the real edges instead of passing vacuously", () => {
  // A detector that resolves nothing would report zero violations for the wrong
  // reason. These three edges are the ones the layering actually relies on.
  const edge = (from, to) =>
    report.edges.find((candidate) => candidate.from === from && candidate.to === to);
  assert.ok(
    edge("build/vite-adapter.ts", "core/content.ts"),
    "the Vite adapter must import Core content",
  );
  assert.ok(
    edge("build/vite-adapter.ts", "static.ts"),
    "the Vite adapter must import the static builder",
  );
  assert.ok(
    edge("vite.ts", "build/vite-adapter.ts"),
    "the public /vite entry must re-export the adapter",
  );
  assert.ok(
    report.edges.some((candidate) => candidate.fromLayer === "ui" && candidate.toLayer === "core"),
    "UI must still be allowed to depend on Core",
  );
  assert.ok(
    report.edges.length >= 40,
    `expected the full relative import graph, found ${report.edges.length} edges`,
  );
});

test("the layer map keeps Core free of upward edges", () => {
  assert.deepEqual(ALLOWED_DEPENDENCIES.core, ["core"]);
  assert.deepEqual(ALLOWED_DEPENDENCIES.build, ["core", "build"]);
  assert.deepEqual(ALLOWED_DEPENDENCIES.ui, ["core", "ui"]);
  assert.equal(layerOf("core/content.ts"), "core");
  assert.equal(layerOf("build/vite-adapter.ts"), "build");
  assert.equal(layerOf("app.tsx"), "ui");
  assert.equal(layerOf("index.ts"), "entry");
  assert.equal(layerOf("unknown-module.ts"), undefined);
});

test("controlled reverse dependencies are rejected on synthetic input", () => {
  const { results, ok } = runLayerSelfTest();
  for (const result of results) {
    assert.ok(
      result.ok,
      `${result.id} (${result.what}) produced [${result.actual.join(", ")}] but the gate expected [${result.expected.join(", ")}]`,
    );
  }
  assert.ok(ok, "the layer self-test did not reject every controlled reverse dependency");
  assert.ok(results.length >= 10, `expected the full self-test set, found ${results.length} scenarios`);
  assert.ok(
    results.some((result) => result.id === "allowed-one-way-edges" && result.actual.length === 0),
    "the self-test must also prove the allowed direction stays green",
  );
});
