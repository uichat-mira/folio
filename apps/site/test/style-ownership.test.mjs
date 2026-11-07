import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const siteSrc = new URL("../src/", import.meta.url);
const siteCssFiles = readdirSync(siteSrc).filter((file) => file.endsWith(".css"));

test("official site styles only its own composition, never Folio component internals", () => {
  for (const file of siteCssFiles) {
    const css = readFileSync(new URL(file, siteSrc), "utf8");
    // .folio-portal-home is an official-site composition class, not a
    // shared Folio package component. All other .folio-* selectors belong
    // to the package and must not be targeted by official-site styles.
    const ownedByPackage = [...css.matchAll(/\.(folio-[a-z][\w-]*)/gi)]
      .map((match) => match[1])
      .filter((className) => className !== "folio-portal-home");
    assert.deepEqual(ownedByPackage, [], `${file} must not override Folio-owned selectors`);
  }
});
