import assert from "node:assert/strict";
import test from "node:test";
import { validateReview, buildPrompt, renderComment, MARKER, MODEL, configureOpencodeRuntimePath } from "./review.mjs";

const context = {
  repository: "uichat-mira/folio",
  number: 123,
  baseSha: "a".repeat(40),
  headSha: "b".repeat(40),
  organizationPolicy: "trusted policy",
  outputContract: "trusted output",
  profile: "trusted profile",
  agents: "trusted repo rules",
  diff: "diff --git a/foo b/foo\n+changed",
  diffTruncated: false
};

test("a bounded review can be rendered with exact identities", () => {
  const review = validateReview({
    verdict: "NO_BLOCKING_FINDINGS", findings: [], validationGaps: ["External runtime not exercised"]
  });
  const text = renderComment(context, { state: "COMPLETED", review });
  assert.match(text, /NO_BLOCKING_FINDINGS/);
  assert.ok(text.includes(MARKER));
  assert.ok(text.includes(context.baseSha));
  assert.ok(text.includes(context.headSha));
  assert.ok(text.includes(MODEL));
  assert.match(text, /External runtime not exercised/);
});

test("incomplete and contradictory review verdicts are rejected", () => {
  assert.throws(() => validateReview({ verdict: "APPROVED", findings: [], validationGaps: [] }));
  assert.throws(() => validateReview({ verdict: "CHANGES_NEEDED", findings: [], validationGaps: [] }));
  assert.throws(() => validateReview({ verdict: "HUMAN_CHECK_NEEDED", findings: [], validationGaps: [] }));
  assert.throws(() => validateReview({
    verdict: "NO_BLOCKING_FINDINGS", findings: [], validationGaps: [],
    contractConflict: { sources: [], conflictingRequirements: [], whyItChangesJudgment: "", maintainerDecisionRequired: "" }
  }));
});

test("an unavailable provider cannot masquerade as a passed review", () => {
  const text = renderComment(context, { state: "REVIEW_UNAVAILABLE", reason: "provider_credential_unavailable" });
  assert.match(text, /REVIEW_UNAVAILABLE/);
  assert.doesNotMatch(text, /NO_BLOCKING_FINDINGS/);
  assert.match(text, /provider_credential_unavailable/);
});

test("the model prompt distinguishes trusted contracts and untrusted diff", () => {
  const text = buildPrompt(context);
  assert.match(text, /TRUSTED_ORGANIZATION_POLICY/);
  assert.match(text, /UNTRUSTED_PR_DIFF/);
  assert.match(text, /diff --git/);
  assert.ok(text.includes(context.headSha));
});

test("review workflow contains valid GitHub Actions expressions", async () => {
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const { resolve, dirname } = await import("node:path");
  const path = resolve(dirname(fileURLToPath(import.meta.url)), "../../.github/workflows/mira-ai-review.yml");
  const yaml = await readFile(path, "utf8");
  const expressions = yaml.match(/\$\{\{[^\n{}]+\}\}/g) ?? [];
  assert.equal(expressions.length, 5, "Every required Actions interpolation must have two opening braces");
  assert.equal((yaml.match(/\$\{/g) ?? []).length, expressions.length, "No malformed Actions interpolation");
  assert.match(yaml, /pull_request_target:/);
  assert.match(yaml, /ready_for_review/);
  assert.match(yaml, /github\.event\.pull_request\.base\.sha/);
  assert.match(yaml, /issues: write/);
  assert.doesNotMatch(yaml, /runner\.temp/, "runner context must not be used in job-level env");
  assert.match(yaml, /FOLIO_REVIEW_CONTEXT_PATH=\$RUNNER_TEMP/, "runner path resolved in job step");
});

test("OpenCode SDK launcher resolves the pinned CLI bin directory", () => {
  const env = { PATH: "/usr/bin" };
  const path = configureOpencodeRuntimePath(
    "/tmp/folio-opencode-runtime/node_modules/@opencode-ai/sdk/dist/index.js", env
  );
  assert.equal(path, "/tmp/folio-opencode-runtime/node_modules/.bin");
  assert.equal(env.PATH, path + ":/usr/bin");
});
