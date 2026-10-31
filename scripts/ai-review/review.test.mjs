import assert from "node:assert/strict";
import test from "node:test";
import { validateReview, buildPrompt, renderComment, MARKER, MODEL } from "./review.mjs";

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
