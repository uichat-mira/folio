import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Mock only the subprocess/network boundary: the production cache, candidate
// matching, and retry logic execute unchanged against a controlled clock.
function harness(responses) {
  const source = readFileSync(new URL("../src/build/github-avatars.ts", import.meta.url), "utf8");
  const { outputText, diagnostics } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    reportDiagnostics: true,
  });
  assert.equal(diagnostics?.length ?? 0, 0);
  let now = 100_000;
  let calls = 0;
  const exports = {};
  const subprocess = () => {
    const next = responses[calls++];
    if (next instanceof Error) throw next;
    return JSON.stringify(next);
  };
  vm.runInNewContext(outputText, {
    exports,
    require: (name) => {
      assert.equal(name, "node:child_process");
      return { execFileSync: subprocess };
    },
    process: { env: {}, execPath: "/bin/node" },
    Date: { now: () => now },
  });
  return {
    resolve: exports.githubAvatarsForAuthors,
    advance: (ms) => { now += ms; },
    calls: () => calls,
  };
}

const remote = "https://github.com/uichat-mira/folio.git";
const author = [{ email: "editor@example.test", sha: "a".repeat(40) }];

test("a temporary GitHub failure is retried after the short cooldown", () => {
  const h = harness([new Error("offline"), [{ login: "editor", id: 12345 }]]);
  assert.equal(h.resolve(remote, author).size, 0);
  assert.equal(h.resolve(remote, author).size, 0);
  assert.equal(h.calls(), 1, "rapid rebuild should not retry a failing network");
  h.advance(60_001);
  assert.equal(h.resolve(remote, author).get(author[0].email)?.avatarUrl,
    "https://avatars.githubusercontent.com/u/12345?s=64");
  assert.equal(h.resolve(remote, author).size, 1);
  assert.equal(h.calls(), 2, "successful identities remain cached");
});

test("a valid GitHub response with no associated author can be retried later", () => {
  const h = harness([[null], [{ login: "editor", id: 12345 }]]);
  assert.equal(h.resolve(remote, author).size, 0);
  h.advance(59_999);
  assert.equal(h.resolve(remote, author).size, 0);
  assert.equal(h.calls(), 1);
  h.advance(2);
  assert.equal(h.resolve(remote, author).get(author[0].email)?.login, "editor");
  assert.equal(h.calls(), 2);
});
