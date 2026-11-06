import assert from "node:assert/strict";
import test from "node:test";
import {
  defineFolioConfig,
  normalizeBasePath,
  resolveGithubPagesBase,
} from "../dist/index.js";

// FOL-032 (B2c) moved config.ts into src/core. These cases pin the base-path
// contract so the relocation cannot quietly change normalisation behaviour.

test("normalizeBasePath keeps a single leading and trailing slash", () => {
  assert.equal(normalizeBasePath(), "/");
  assert.equal(normalizeBasePath("/"), "/");
  assert.equal(normalizeBasePath(""), "/");
  assert.equal(normalizeBasePath("docs"), "/docs/");
  assert.equal(normalizeBasePath("/docs/"), "/docs/");
  assert.equal(normalizeBasePath("a/b"), "/a/b/");
  assert.equal(normalizeBasePath("/nested/project/"), "/nested/project/");
});

test("normalizeBasePath only strips the outer slashes", () => {
  // Interior double slashes are preserved: this helper normalises the wrapper,
  // not the path segments.
  assert.equal(normalizeBasePath("//a//b//"), "/a//b/");
});

test("resolveGithubPagesBase returns / for user, organisation and empty input", () => {
  assert.equal(resolveGithubPagesBase(), "/");
  assert.equal(resolveGithubPagesBase(undefined), "/");
  assert.equal(resolveGithubPagesBase(""), "/");
  assert.equal(resolveGithubPagesBase("user/user.github.io"), "/");
  assert.equal(resolveGithubPagesBase("uichat-mira/uichat-mira.github.io"), "/");
});

test("resolveGithubPagesBase returns a project base for repository names", () => {
  assert.equal(resolveGithubPagesBase("user/repo"), "/repo/");
  assert.equal(resolveGithubPagesBase("user/repo/"), "/repo/");
});

test("resolveGithubPagesBase returns / without an owner/repo separator", () => {
  assert.equal(resolveGithubPagesBase("single"), "/");
});

test("defineFolioConfig returns the configuration object unchanged", () => {
  const config = { title: "Docs", description: "Fixture" };
  assert.equal(defineFolioConfig(config), config);
  assert.deepEqual(defineFolioConfig(config), { title: "Docs", description: "Fixture" });
});
