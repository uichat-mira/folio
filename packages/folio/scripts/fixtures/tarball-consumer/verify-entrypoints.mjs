// Runs inside the isolated consumer installation. Every specifier below is
// resolved by Node from this directory, so it can only succeed through the
// installed tarball and its declared peers/dependencies.
import assert from "node:assert/strict";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const consumerDir = dirname(fileURLToPath(import.meta.url));

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const expectedVersion = readArgument("--expected-version");
const repositoryRoot = readArgument("--repo-root");

const normalize = (value) => resolve(value).toLowerCase().replace(/\\/g, "/");
const isInside = (child, parent) =>
  normalize(child).startsWith(`${normalize(parent)}/`);

let packageDir;

const checks = [
  {
    label: "root",
    async run() {
      const url = import.meta.resolve("@uichat-mira/folio");
      assert.ok(url.startsWith("file:"), `root resolved to a non-file URL: ${url}`);

      const entryFile = fileURLToPath(url);
      assert.match(
        normalize(entryFile),
        /\/dist\/index\.js$/,
        `root entry resolved to ${entryFile}, expected dist/index.js`,
      );

      packageDir = dirname(dirname(entryFile));
      assert.equal(
        lstatSync(packageDir).isSymbolicLink(),
        false,
        `installed package is a symlink, not a tarball installation: ${packageDir}`,
      );

      const installedReal = realpathSync(packageDir);
      const expectedInstall = join(realpathSync(consumerDir), "node_modules", "@uichat-mira", "folio");
      assert.equal(
        normalize(installedReal),
        normalize(expectedInstall),
        `package resolved outside the consumer installation: ${installedReal}`,
      );
      assert.ok(
        !isInside(installedReal, repositoryRoot),
        `package resolved inside the repository workspace: ${installedReal}`,
      );

      const installedManifest = JSON.parse(
        readFileSync(join(installedReal, "package.json"), "utf8"),
      );
      assert.equal(installedManifest.name, "@uichat-mira/folio");
      assert.equal(
        installedManifest.version,
        expectedVersion,
        `installed ${installedManifest.version}, expected ${expectedVersion}`,
      );

      const entry = await import("@uichat-mira/folio");
      assert.equal(typeof entry.FolioApp, "function", "root entry does not export FolioApp");
      assert.equal(
        typeof entry.parseFolioDoc,
        "function",
        "root entry does not export parseFolioDoc",
      );
      assert.equal(
        typeof entry.defineFolioConfig,
        "function",
        "root entry does not export defineFolioConfig",
      );
      assert.equal(
        typeof entry.resolveFolioHome,
        "function",
        "root entry does not export resolveFolioHome",
      );

      const doc = entry.parseFolioDoc(
        "docs/consumer.md",
        "---\ntitle: Consumer\ndescription: tarball entry\n---\n# Consumer\n",
      );
      assert.equal(doc.title, "Consumer", "parseFolioDoc did not run through the tarball build");
      return `${installedReal} (FolioApp, parseFolioDoc)`;
    },
  },
  {
    label: "vite",
    async run() {
      const url = import.meta.resolve("@uichat-mira/folio/vite");
      const entryFile = fileURLToPath(url);
      assert.match(
        normalize(entryFile),
        /\/dist\/vite\.js$/,
        `vite entry resolved to ${entryFile}, expected dist/vite.js`,
      );
      assert.ok(isInside(entryFile, packageDir), `vite entry escaped the package: ${entryFile}`);

      const entry = await import("@uichat-mira/folio/vite");
      assert.equal(typeof entry.folio, "function", "vite entry does not export folio()");
      assert.equal(
        entry.folioVirtualModule,
        "virtual:folio/content",
        "vite entry exported an unexpected virtual module id",
      );
      assert.equal(
        typeof entry.renderFolioStaticHome,
        "function",
        "vite entry does not export renderFolioStaticHome",
      );

      const plugin = entry.folio({
        config: { title: "Consumer", description: "Tarball consumer" },
        staticRoutes: false,
      });
      assert.equal(plugin.name, "folio", "folio() did not return the Folio Vite plugin");
      return `${entryFile} (folio(), folioVirtualModule)`;
    },
  },
  {
    label: "styles.css",
    async run() {
      const url = import.meta.resolve("@uichat-mira/folio/styles.css");
      const entryFile = fileURLToPath(url);
      assert.match(
        normalize(entryFile),
        /\/dist\/styles\.css$/,
        `styles.css resolved to ${entryFile}, expected dist/styles.css`,
      );
      assert.ok(isInside(entryFile, packageDir), `styles.css escaped the package: ${entryFile}`);

      const css = readFileSync(entryFile, "utf8");
      assert.ok(css.length > 1000, `styles.css is unexpectedly small: ${css.length} bytes`);
      assert.ok(
        css.includes("--folio-primary"),
        "styles.css does not contain the Folio custom properties",
      );
      return `${entryFile} (${css.length} bytes)`;
    },
  },
];

const failures = [];

for (const check of checks) {
  try {
    const detail = await check.run();
    console.log(`[${check.label}] ok  ${detail}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${check.label}] FAIL ${message}`);
    failures.push(check.label);
  }
}

if (failures.length > 0) {
  console.error(`\nFailed entrypoint(s): ${failures.join(", ")}`);
  process.exit(1);
}
