import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const dist = new URL("../dist/", import.meta.url);
mkdirSync(dist, { recursive: true });
copyFileSync(
  new URL("../src/styles.css", import.meta.url),
  new URL("../dist/styles.css", import.meta.url),
);

// tsup generates the public .d.ts entrypoints but does not automatically
// include an unimported ambient declaration. Copy and explicitly reference
// the declaration so a fresh tarball consumer resolves virtual:folio/content
// through either public entrypoint, without a project-local workaround.
copyFileSync(
  new URL("../src/virtual.d.ts", import.meta.url),
  new URL("../dist/virtual.d.ts", import.meta.url),
);
for (const name of ["index.d.ts", "vite.d.ts"]) {
  const entry = new URL(name, dist);
  const types = readFileSync(entry, "utf8");
  writeFileSync(entry, `/// <reference path="./virtual.d.ts" />\n${types}`);
}
