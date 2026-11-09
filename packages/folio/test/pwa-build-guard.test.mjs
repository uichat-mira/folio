// FOL-039 (Issue #160) P1: the multi-page precache boundary is enforced on the
// *emitted* Workbox worker, not only on the options Folio passed in.
//
// Why a real Vite build instead of a unit assertion: the escape hatch that
// matters is `workbox.manifestTransforms`, a consumer-supplied function that
// runs inside Workbox and can inject an entry Folio never saw. No config-time
// check can see those entries, so the only honest proof is to build a site with
// a transform that injects a generated page and assert the build fails.
//
// The fixture is built here (not packed) because this is a Build-layer rule and
// `npm test` already runs `npm run build`: `dist/` is the same code the tarball
// ships, and the tarball path is covered by scripts/checks/pwa-consumer.mjs.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { build } from "vite";

import { folio } from "../dist/vite.js";
import { folioPwa } from "../dist/pwa.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// A real 1x1 PNG: the manifest validator resolves every icon against the build
// output, so the fixture needs files that actually exist.
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" +
    "0000000d4944415478da63f8ffff3f0005fe02fea735d0d80000000049454e44ae426082",
  "hex",
);

const config = {
  title: "PWA build guard",
  description: "Multi-page precache boundary fixture.",
  siteUrl: "https://example.test",
};
const icons = [
  { src: "icon-192.png", sizes: "192x192" },
  { src: "icon-512.png", sizes: "512x512" },
];

function createFixture(root) {
  // A module entry is required: an HTML-only build leaves Rollup with no chunk
  // to hash, which is not the shape a Folio consumer ever has.
  writeFileSync(
    join(root, "index.html"),
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>guard</title></head>' +
      '<body><div id="root"></div><script type="module" src="/src/main.ts"></script></body></html>',
  );
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src", "main.ts"), 'document.getElementById("root").textContent = "guard";\n');
  mkdirSync(join(root, "content", "docs"), { recursive: true });
  writeFileSync(
    join(root, "content", "docs", "hello.md"),
    "---\ntitle: Hello\ndescription: A generated document page.\n---\n\nBody text.\n",
  );
  mkdirSync(join(root, "public"), { recursive: true });
  writeFileSync(join(root, "public", "icon-192.png"), PNG);
  writeFileSync(join(root, "public", "icon-512.png"), PNG);
  mkdirSync(join(root, "public", "brand"), { recursive: true });
  writeFileSync(join(root, "public", "brand", "font.woff2"), "woff2-fixture");
  writeFileSync(join(root, "public", "brand", "extra.json"), '{"injected":true}\n');
}

async function runBuild(root, name, { pwaOptions = {}, base = "/" } = {}) {
  // Vite's HTML plugin resolves `index.html` against the *process* cwd, so an
  // otherwise-absolute fixture root would make it emit a chunk named with a
  // "../../.." path. Entering the fixture keeps the build identical to a real
  // consumer build; the previous cwd is restored even on failure.
  const previous = process.cwd();
  process.chdir(root);
  try {
    return await build({
      configFile: false,
      root: ".",
      base,
      logLevel: "silent",
      plugins: [
        folio({ config, contentDir: "content", staticRoutes: true }),
        ...folioPwa({ config, icons, ...pwaOptions }),
      ],
      build: { outDir: `dist-${name}`, emptyOutDir: true },
    });
  } finally {
    process.chdir(previous);
  }
}

// Async-aware: a `try/finally` around `return run(root)` would delete the
// fixture while the build is still reading it, turning every failure into a
// misleading "could not resolve entry module".
async function withFixture(run) {
  const root = mkdtempSync(join(tmpdir(), "folio-pwa-guard-"));
  try {
    createFixture(root);
    return await run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("a legitimate build passes the emitted-manifest boundary", () =>
  withFixture(async (root) => {
    // Static assets through both escape hatches: this is the case that must keep
    // working, so the guard cannot be "reject everything custom".
    await runBuild(root, "ok", {
      pwaOptions: {
        includeAssets: ["brand/font.woff2"],
        workbox: {
          additionalManifestEntries: ["brand/font.woff2"],
          manifestTransforms: [
            (entries) => ({
              manifest: [
                ...entries,
                { url: "brand/extra.json", revision: "revision-fixture" },
              ],
              warnings: [],
            }),
          ],
        },
      },
    });
    assert.ok(true);
  }));

test("a transform that injects a generated page fails the build", () =>
  withFixture(async (root) => {
    // This is the bypass the review found: `additionalManifestEntries` can be
    // spelled as a directory URL, and a transform can append anything at all.
    const injections = [
      "docs/hello/",
      "docs/hello/index.html",
      "docs/hello/index.html?cache=1",
      "docs%2Fhello%2F",
      "index.html",
      "docs/index",
      "404.html",
    ];
    for (const url of injections) {
      await assert.rejects(
        () =>
          runBuild(root, "inject", {
            pwaOptions: {
              workbox: {
                manifestTransforms: [
                  (entries) => ({
                    manifest: [...entries, { url, revision: "injected" }],
                    warnings: [],
                  }),
                ],
              },
            },
          }),
        /precaches generated pages|names a generated page/,
        `the build accepted the injected page entry ${JSON.stringify(url)}`,
      );
    }
  }));

test("a transform cannot strip the content-version entry", () =>
  withFixture(async (root) => {
    // `manifestTransforms` runs before `additionalManifestEntries`, so Folio's
    // revisioned `folio-version.json` entry is appended after any consumer
    // transform. A transform that returns an empty manifest therefore cannot
    // erase the update signal -- it only removes the assets it was given.
    await runBuild(root, "stripped", {
      pwaOptions: {
        workbox: { manifestTransforms: [() => ({ manifest: [], warnings: [] })] },
      },
    });
    const worker = readFileSync(join(root, "dist-stripped", "sw.js"), "utf8");
    const urls = [...worker.matchAll(/url:"([^"]+)"/g)].map((match) => match[1]);
    // The transform dropped the globbed assets, but Folio's own revisioned entry
    // is appended after every consumer transform and the static manifest/icons
    // are added by the upstream plugin, so the update signal survives.
    assert.ok(
      urls.includes("folio-version.json"),
      `the content-version entry did not survive a consumer transform: ${urls.join(", ")}`,
    );
    assert.ok(
      !urls.some((url) => url.startsWith("assets/")),
      `the transform did not actually strip the globbed assets: ${urls.join(", ")}`,
    );
  }));

test("an unreadable worker precache manifest fails closed", () =>
  withFixture(async (root) => {
    // Upstream could change the emitted worker format; the validator must then
    // fail the build instead of reading "no entries" as "no violations". A
    // consumer plugin placed after `folioPwa()` runs before Folio's own
    // `enforce: "post"` validator, so it can simulate exactly that drift.
    const corruptWorker = {
      name: "folio-pwa-test-corrupt-worker",
      enforce: "post",
      closeBundle: {
        sequential: true,
        order: "post",
        handler() {
          writeFileSync(
            join(root, "dist-corrupt", "sw.js"),
            "self.addEventListener('install', () => {});\n",
          );
        },
      },
    };
    // The corrupt plugin has to run after the worker is written and before
    // Folio's validator, so it is spliced between them instead of appended: this
    // reproduces "an upstream format change" without touching Folio's code.
    const pwaPlugins = folioPwa({ config, icons });
    const validator = pwaPlugins.pop();
    const plugins = [
      folio({ config, contentDir: "content", staticRoutes: true }),
      ...pwaPlugins,
      corruptWorker,
      validator,
    ];
    await assert.rejects(
      async () => {
        const previous = process.cwd();
        process.chdir(root);
        try {
          await build({
            configFile: false,
            root: ".",
            base: "/",
            logLevel: "silent",
            plugins,
            build: { outDir: "dist-corrupt", emptyOutDir: true },
          });
        } finally {
          process.chdir(previous);
        }
      },
      /no readable precacheAndRoute|does not precache/,
      "a worker without a readable precache manifest was accepted",
    );
  }));

test("a sub-path build resolves asset entries against the same output", () =>
  withFixture(async (root) => {
    // The worker only ever lists base-relative URLs, so the same allowlist has to
    // work under a non-root base; a wrong resolution rule would reject every
    // legitimate asset here.
    await runBuild(root, "subpath", { base: "/folio-smoke/" });
    assert.ok(true);
  }));
