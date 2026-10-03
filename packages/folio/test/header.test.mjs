import assert from "node:assert/strict";
import test from "node:test";
import {
  FolioHeader,
  FolioShareButton,
} from "../dist/index.js";

test("header primitives are public runtime exports", () => {
  assert.equal(typeof FolioHeader, "function");
  assert.equal(typeof FolioShareButton, "function");
});
