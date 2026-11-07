import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveFolioReaderKind, shouldShowFolioPageFooter,
} from "../dist/index.js";

test("reading layout classification is the sole source of footer policy", () => {
  for (const [type, reader] of [
    ["doc", "document"],
    ["project", "project"],
    ["article", null],
    ["page", null],
  ]) {
    assert.equal(resolveFolioReaderKind({ type }, true), reader, type);
    assert.equal(
      shouldShowFolioPageFooter(reader, false),
      reader === null,
      "footer should only be hidden in the reader layout for " + type,
    );
    assert.equal(shouldShowFolioPageFooter(reader, true), true);
    assert.equal(shouldShowFolioPageFooter(reader, undefined), true);
    assert.equal(resolveFolioReaderKind({ type }, false), null);
  }
  assert.equal(resolveFolioReaderKind(undefined, true), null);
  assert.equal(shouldShowFolioPageFooter(null, false), true);
});

test("global and article footers share one decision", () => {
  for (const type of ["doc", "project", "article"]) {
    const reader = resolveFolioReaderKind({ type }, true);
    const visible = shouldShowFolioPageFooter(reader, false);
    const siteFooter = visible ? "site footer" : undefined;
    const articleFooter = visible ? "article footer" : undefined;
    assert.equal(Boolean(siteFooter), Boolean(articleFooter));
  }
});
