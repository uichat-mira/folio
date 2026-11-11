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
      assert.equal("FolioDocNav" in entry, false, "obsolete separate sidebar entry is still exported");
      assert.equal(typeof entry.FolioToc, "function", "root entry does not export FolioToc");
      assert.equal(typeof entry.FolioPageNav, "function", "root entry does not export FolioPageNav");
      assert.equal(typeof entry.FolioDocMeta, "function", "root entry does not export FolioDocMeta");
      assert.equal(typeof entry.getFolioDocMeta, "function", "root entry does not export getFolioDocMeta");
      assert.equal(typeof entry.FolioTreeNav, "function", "root entry does not export FolioTreeNav");
      assert.equal(typeof entry.buildFolioNavigationTree, "function", "root entry does not export the unified navigation model");
      assert.equal(typeof entry.getFolioNavigationNeighbors, "function", "root entry does not export unified reading neighbors");
      assert.equal(typeof entry.buildFolioContentTree, "function", "root entry does not export buildFolioContentTree");
      assert.equal(typeof entry.resolveFolioProjectTree, "function", "root entry does not export resolveFolioProjectTree");
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
      assert.equal(typeof entry.resolveFolioAppearance, "function", "appearance resolver must ship in the tarball");
      assert.equal(typeof entry.resolveFolioCodePalette, "function", "code palette resolver must ship in the tarball");
      assert.deepEqual(entry.resolveFolioAppearance({}), { preset: "pearl", scheme: "system", codePalette: "auto" });
      assert.equal(entry.resolveFolioCodePalette("xuanmo", "light"), "xuanmo");

      const doc = entry.parseFolioDoc(
        "docs/consumer.md",
        "---\ntitle: Consumer\ndescription: tarball entry\n---\n# Consumer\n",
      );
      assert.equal(doc.title, "Consumer", "parseFolioDoc did not run through the tarball build");

      // FOL-025: the date contract itself must survive packaging.
      const dated = entry.parseFolioDoc(
        "docs/dated.md",
        "---\ntitle: Dated\npublishedAt: 2025-01-02T03:04:05+08:00\nupdatedAt: 2025-02-03\n---\n# Dated\n",
      );
      assert.equal(
        dated.publishedAt,
        "2025-01-01T19:04:05.000Z",
        "the tarball did not normalize publishedAt to UTC",
      );
      assert.equal(
        dated.updatedAt,
        "2025-02-03T00:00:00.000Z",
        "the tarball did not normalize the updatedAt date",
      );
      assert.deepEqual(
        dated.dateSources,
        { publishedAt: "frontmatter", updatedAt: "frontmatter" },
        "the tarball lost the date provenance contract",
      );
      return `${installedReal} (FolioApp, parseFolioDoc, dates)`;
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
      assert.equal(typeof entry.renderFolioStaticProjectShell, "function", "vite entry lacks project renderer");
      assert.equal(typeof entry.renderFolioStaticPageNav, "function", "vite entry lacks shared static pager");
      assert.equal(typeof entry.renderFolioStaticDocMeta, "function", "vite entry lacks static document metadata");
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
      assert.ok(css.includes(".folio-tree-nav"), "styles.css lacks unified navigation");
      assert.equal(css.includes(".folio-docnav"), false, "legacy sidebar CSS still ships");
      assert.ok(css.includes(".folio-toc"), "styles.css lacks page TOC");
      assert.ok(css.includes(".folio-tree-nav"), "styles.css lacks project tree navigation");
      return `${entryFile} (${css.length} bytes)`;
    },
  },
  {
    // FOL-039: the optional PWA integration must resolve through the published
    // export map from the installed tarball, without the consumer installing
    // anything beyond the declared optional peers.
    label: "pwa",
    async run() {
      for (const [subpath, file, names] of [
        [
          "@uichat-mira/folio/pwa",
          "pwa.js",
          ["folioPwa", "computeFolioContentVersion", "FOLIO_PWA_CONTENT_VERSION_FILE"],
        ],
        ["@uichat-mira/folio/pwa/react", "pwa-react.js", ["FolioPwaUpdatePrompt", "useFolioPwaUpdate"]],
      ]) {
        const url = import.meta.resolve(subpath);
        const entryFile = fileURLToPath(url);
        assert.match(
          normalize(entryFile),
          new RegExp(`\\/dist\\/${file.replace(".", "\\.")}$`),
          `${subpath} resolved to ${entryFile}, expected dist/${file}`,
        );
        assert.ok(isInside(entryFile, packageDir), `${subpath} escaped the package: ${entryFile}`);
        // The plugin half is a pure config helper and loads in Node.
        //
        // The React half is deliberately *not* imported here: it imports
        // `virtual:pwa-register/react`, which only exists inside a Vite build.
        // That is the upstream client contract (the same restriction applies to
        // `vite-plugin-pwa` itself), so this check asserts the published entry,
        // its declarations and that it defers to the virtual module instead of
        // pretending a Node import works.
        if (subpath.endsWith("/react")) {
          const source = readFileSync(entryFile, "utf8");
          assert.match(
            source,
            /from "virtual:pwa-register\/react"/,
            `${subpath} does not delegate to the official update client`,
          );
          for (const name of names) {
            assert.ok(
              source.includes(name),
              `${subpath} build output does not expose ${name}`,
            );
          }
          const declarations = readFileSync(
            join(dirname(entryFile), "pwa-react.d.ts"),
            "utf8",
          );
          for (const name of [...names, "FolioPwaUpdateState", "FolioPwaUpdateOptions"]) {
            assert.ok(
              declarations.includes(name),
              `dist/pwa-react.d.ts is missing ${name}`,
            );
          }
        } else {
          const entry = await import(subpath);
          for (const name of names) {
            assert.ok(name in entry, `${subpath} does not export ${name}`);
          }
          assert.equal(entry.FOLIO_PWA_CONTENT_VERSION_FILE, "folio-version.json");
          // Validation runs before any build, so an unsafe consumer config fails
          // immediately instead of shipping a broken worker.
          assert.throws(
            () =>
              entry.folioPwa({
                config: { title: "Consumer", description: "Tarball consumer" },
                icons: [{ src: "icon-192.png", sizes: "192x192" }],
              }),
            /at least 512x512/,
            "the installed folioPwa() did not validate its icons",
          );
          const plugins = entry.folioPwa({
            config: { title: "Consumer", description: "Tarball consumer" },
            icons: [
              { src: "icon-192.png", sizes: "192x192" },
              { src: "icon-512.png", sizes: "512x512" },
            ],
          });
          assert.ok(Array.isArray(plugins) && plugins.length > 0, "folioPwa() returned no plugins");
          assert.ok(
            plugins.some((plugin) => plugin.name === "folio:pwa"),
            "the installed folioPwa() did not return the Folio plugin",
          );
        }
      }
      return "dist/pwa.js + dist/pwa-react.js (folioPwa, update hook, prompt)";
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
