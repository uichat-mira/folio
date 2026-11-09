// FOL-039 (Issue #160): targeted regression tests for the optional PWA
// integration. These run against the built `dist/pwa.js` (the workspace
// `npm test` builds first), so a broken build or a drifted entry fails here.
//
// What is covered here, and what is deliberately covered elsewhere:
//
//   here           option validation, content-version determinism, update
//                  throttle policy, manifest derivation, and the static
//                  assertions over a real generated site (no HTML precache,
//                  no navigation fallback, content version in the worker).
//   tarball check  the full plugin composition in a real isolated consumer,
//                  root and subpath deployments, prompt/auto/disabled modes
//                  (scripts/checks/pwa-consumer.mjs).
//   Chrome harness the real browser update prompt/confirm/dismiss flow
//                  (docs/research/fol-039/browser-prompt.mjs).
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  FOLIO_PWA_CONTENT_VERSION_FILE,
  computeFolioContentVersion,
  folioPwa,
} from "../dist/pwa.js";
import {
  FOLIO_PWA_UPDATE_CHECK_INTERVAL_MS,
  folioPwaRegistrationState,
  shouldCheckFolioPwaUpdate,
} from "../dist/index.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const baseConfig = { title: "PWA fixture", description: "PWA fixture site" };
const icons = [
  { src: "icon-192.png", sizes: "192x192" },
  { src: "icon-512.png", sizes: "512x512" },
];

function withTempDir(run) {
  const directory = mkdtempSync(join(tmpdir(), "folio-pwa-test-"));
  try {
    return run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function writeSite(root, pages) {
  for (const [relative, body] of Object.entries(pages)) {
    const target = join(root, relative);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body, "utf8");
  }
}

// --- package surface ---------------------------------------------------------

test("the built PWA entry owns the documented public surface", () => {
  assert.equal(typeof folioPwa, "function", "dist/pwa.js must export folioPwa()");
  assert.equal(typeof computeFolioContentVersion, "function");
  assert.equal(FOLIO_PWA_CONTENT_VERSION_FILE, "folio-version.json");

  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  assert.deepEqual(manifest.exports["./pwa"], {
    types: "./dist/pwa.d.ts",
    import: "./dist/pwa.js",
    default: "./dist/pwa.js",
  });
  assert.deepEqual(manifest.exports["./pwa/react"], {
    types: "./dist/pwa-react.d.ts",
    import: "./dist/pwa-react.js",
    default: "./dist/pwa-react.js",
  });
  // The plain entries must not gain PWA behavior implicitly.
  assert.deepEqual(manifest.exports["."], {
    types: "./dist/index.d.ts",
    import: "./dist/index.js",
    default: "./dist/index.js",
  });
  assert.equal(
    "folioPwa" in manifest.exports["."],
    false,
    "the root entry must not re-export the PWA integration; opt-in stays explicit",
  );
});

test("PWA dependencies are optional peers, never hard dependencies", () => {
  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  for (const name of ["vite-plugin-pwa", "workbox-window"]) {
    assert.ok(
      !manifest.dependencies?.[name],
      `${name} must not be a runtime dependency; a plain folio() consumer must not install Workbox`,
    );
    assert.ok(
      manifest.devDependencies?.[name],
      `${name} must be a dev dependency so this repository can build and test the integration`,
    );
    assert.ok(
      manifest.peerDependencies?.[name],
      `${name} must be declared as a peer dependency for consumers that opt in`,
    );
    assert.equal(
      manifest.peerDependenciesMeta?.[name]?.optional,
      true,
      `${name} must be an OPTIONAL peer; installing Folio must not require the PWA toolchain`,
    );
  }
});

// --- option validation -------------------------------------------------------

test("folioPwa rejects an uninstallable or deployment-unsafe configuration", () => {
  assert.throws(() => folioPwa(), /requires an options object/);
  assert.throws(() => folioPwa({ icons }), /requires the Folio config/);
  assert.throws(
    () => folioPwa({ config: { title: "", description: "x" }, icons }),
    /requires config\.title/,
  );
  // Icons are a consumer decision, never inferred from config.logo.
  assert.throws(() => folioPwa({ config: baseConfig, icons: [] }), /does not infer icon sizes/);
  assert.throws(
    () => folioPwa({ config: baseConfig, icons: [{ src: "a.png", sizes: "192x192" }] }),
    /at least 512x512/,
  );
  assert.throws(
    () =>
      folioPwa({
        config: baseConfig,
        icons: [...icons, { src: "icon-192.png", sizes: "192x192" }],
      }),
    /listed twice/,
  );
  assert.throws(
    () => folioPwa({ config: baseConfig, icons: [{ src: "a.png", sizes: "wide" }] }),
    /invalid sizes/,
  );
});

test("folioPwa refuses an SPA fallback and an HTML precache", () => {
  assert.throws(
    () =>
      folioPwa({
        config: baseConfig,
        icons,
        workbox: { navigateFallback: "index.html" },
      }),
    /navigateFallback is not supported/,
  );
  assert.throws(
    () =>
      folioPwa({
        config: baseConfig,
        icons,
        workbox: { globPatterns: ["**/*.{js,css,html}"] },
      }),
    /may not precache HTML/,
  );
  assert.throws(
    () => folioPwa({ config: baseConfig, icons, includeAssets: ["**/*.html"] }),
    /may not precache HTML/,
  );
  // navigateFallback-only options are meaningless without the fallback.
  assert.throws(
    () =>
      folioPwa({
        config: baseConfig,
        icons,
        workbox: { navigateFallbackDenylist: [/^\/api/] },
      }),
    /only make sense with navigateFallback/,
  );
});

test("folioPwa keeps the update modes separate", () => {
  assert.throws(
    () => folioPwa({ config: baseConfig, icons, updateMode: "prompt-and-auto" }),
    /updateMode must be "prompt" or "auto"/,
  );
  // A valid prompt configuration builds a plugin array.
  const plugins = folioPwa({ config: baseConfig, icons });
  assert.ok(Array.isArray(plugins) && plugins.length > 0);
  assert.ok(
    plugins.some((plugin) => plugin.name === "folio:pwa"),
    "the integration must own a named Folio plugin",
  );
  assert.ok(
    plugins.some((plugin) => plugin.name === "vite-plugin-pwa"),
    "the integration must be composed of the upstream plugin, not a reimplementation",
  );
});

test("folioPwa refuses manifest fields that must follow the deployment base", () => {
  for (const field of ["scope", "start_url", "id"]) {
    assert.throws(
      () =>
        folioPwa({
          config: baseConfig,
          icons,
          manifest: { [field]: "/wrong/" },
        }),
      new RegExp(`manifest\\.${field} must not be overridden`),
    );
  }
});

// --- content version ---------------------------------------------------------

test("the content version is deterministic and content-sensitive", () =>
  withTempDir((directory) => {
    const v1Pages = {
      "index.html": "<html><body>home v1</body></html>",
      "docs/hello/index.html": "<html><body>hello v1</body></html>",
      "404.html": "<html><body>missing</body></html>",
    };
    writeSite(directory, v1Pages);
    const first = computeFolioContentVersion(directory);
    const second = computeFolioContentVersion(directory);
    assert.equal(first.pages, 3, "every generated page must be counted");
    assert.equal(first.version, second.version, "identical input must hash identically");
    assert.match(first.version, /^[0-9a-f]{32}$/);

    // A Markdown-only edit changes one page body, nothing else.
    writeFileSync(
      join(directory, "docs/hello/index.html"),
      "<html><body>hello v2, edited Markdown</body></html>",
    );
    const edited = computeFolioContentVersion(directory);
    assert.notEqual(
      edited.version,
      first.version,
      "a content-only edit must produce a new version, or clients never see the deployment",
    );

    // Path, not just bytes: a renamed page is a new publication too.
    writeFileSync(join(directory, "docs/hello/index.html"), v1Pages["docs/hello/index.html"]);
    assert.equal(computeFolioContentVersion(directory).version, first.version);
    mkdirSync(join(directory, "docs/renamed"), { recursive: true });
    writeFileSync(join(directory, "docs/renamed/index.html"), v1Pages["docs/hello/index.html"]);
    rmSync(join(directory, "docs/hello"), { recursive: true });
    assert.notEqual(
      computeFolioContentVersion(directory).version,
      first.version,
      "moving a route must change the version",
    );
  }));

test("the content version ignores non-HTML artifacts", () =>
  withTempDir((directory) => {
    writeSite(directory, { "index.html": "<html><body>home</body></html>" });
    const before = computeFolioContentVersion(directory);
    // The version file itself, hashed assets and the worker are excluded: the
    // version must describe content, not the build that embeds it.
    writeSite(directory, {
      "assets/app-1234.js": "console.log(1)",
      "folio-version.json": '{"version":"deadbeef"}',
      "sw.js": "self.skipWaiting()",
    });
    assert.equal(
      computeFolioContentVersion(directory).version,
      before.version,
      "non-HTML artifacts must not change the content version",
    );
  }));

test("the content version fails loudly instead of inventing a value", () =>
  withTempDir((directory) => {
    assert.throws(() => computeFolioContentVersion(join(directory, "missing")), /does not exist/);
    mkdirSync(join(directory, "empty"), { recursive: true });
    assert.throws(() => computeFolioContentVersion(join(directory, "empty")), /no generated HTML/);
  }));

// --- update throttle ---------------------------------------------------------

test("the resume update check is throttled and never spins", () => {
  assert.equal(FOLIO_PWA_UPDATE_CHECK_INTERVAL_MS, 60_000);

  // First resume always checks.
  assert.equal(shouldCheckFolioPwaUpdate(null, 1_000), true);
  assert.equal(shouldCheckFolioPwaUpdate(undefined, 1_000), true);
  // Inside the window: no check.
  assert.equal(shouldCheckFolioPwaUpdate(1_000, 1_001), false);
  assert.equal(shouldCheckFolioPwaUpdate(1_000, 60_999), false);
  // At or past the window: check again.
  assert.equal(shouldCheckFolioPwaUpdate(1_000, 61_000), true);
  assert.equal(shouldCheckFolioPwaUpdate(1_000, 120_000), true);
  // An explicit zero interval disables throttling but stays a real number.
  assert.equal(shouldCheckFolioPwaUpdate(1_000, 1_000, 0), true);
  // A non-finite previous timestamp is treated as "never checked".
  assert.equal(shouldCheckFolioPwaUpdate(Number.NaN, 5), true);
  // An invalid interval is a programming error, not a silent disable.
  for (const interval of [-1, Number.NaN, Number.POSITIVE_INFINITY, "60000"]) {
    assert.throws(
      () => shouldCheckFolioPwaUpdate(0, 1, interval),
      /finite non-negative number/,
    );
  }
});

// --- static contract over the real build ------------------------------------

test("the optional integration is not reachable from the plain entries", () => {
  // `folio()` must stay PWA-free: no manifest, no worker, no registration.
  const viteEntry = readFileSync(join(packageRoot, "dist/vite.js"), "utf8");
  assert.ok(
    !/manifest\.webmanifest/.test(viteEntry),
    "dist/vite.js must not emit or reference a PWA manifest",
  );
  assert.ok(
    !/\bsw\.js\b/.test(viteEntry),
    "dist/vite.js must not generate a service worker",
  );
  assert.ok(
    !/vite-plugin-pwa/.test(viteEntry),
    "dist/vite.js must not import the PWA plugin; a plain consumer must not need it",
  );

  const rootEntry = readFileSync(join(packageRoot, "dist/index.js"), "utf8");
  assert.ok(
    !/vite-plugin-pwa/.test(rootEntry),
    "dist/index.js must not import the PWA plugin",
  );
  assert.ok(
    !/virtual:pwa-register/.test(rootEntry),
    "dist/index.js must not reference the update client",
  );

  // The React entry is the only place the upstream client is imported, and the
  // throttle policy is imported from Core (tsup may hoist it into a shared chunk,
  // so the assertion is on the imported names plus the source edge, not on a
  // specific emitted file name).
  const reactEntry = readFileSync(join(packageRoot, "dist/pwa-react.js"), "utf8");
  assert.match(reactEntry, /from "virtual:pwa-register\/react"/);
  assert.match(
    reactEntry,
    /import \{[^}]*FOLIO_PWA_UPDATE_CHECK_INTERVAL_MS[^}]*shouldCheckFolioPwaUpdate[^}]*\}|import \{[^}]*shouldCheckFolioPwaUpdate[^}]*\}/,
    "the React entry must consume the shared throttle policy instead of re-implementing it",
  );
  const reactSource = readFileSync(join(packageRoot, "src/pwa-react.tsx"), "utf8");
  assert.match(
    reactSource,
    /from "\.\/core\/pwa-update"/,
    "src/pwa-react.tsx must import the throttle policy from Core",
  );
  assert.ok(
    !/lastCheckedAt.*>=.*intervalMs/.test(reactSource),
    "the React entry must not re-implement the throttle comparison",
  );
});

test("the React entry ships the prompt and the hook without global styles", () => {
  const types = readFileSync(join(packageRoot, "dist/pwa-react.d.ts"), "utf8");
  for (const name of ["useFolioPwaUpdate", "FolioPwaUpdatePrompt", "FolioPwaUpdateState"]) {
    assert.ok(types.includes(name), `dist/pwa-react.d.ts is missing ${name}`);
  }
  const source = readFileSync(join(packageRoot, "src/pwa-react.tsx"), "utf8");
  // No design-system dependency and no global CSS leakage: the prompt is styled
  // inline with token fallbacks, so it cannot collide with FOL-033/FOL-034.
  assert.ok(
    !/import\s+["'][^"']+\.css["']/.test(source),
    "the prompt must not import a stylesheet",
  );
  assert.ok(
    !/className=/.test(source),
    "the prompt must not depend on global class-based styling",
  );
  assert.match(source, /data-folio-pwa-update-confirm/, "the confirm control must stay addressable");
  assert.match(source, /data-folio-pwa-update-dismiss/, "the dismiss control must stay addressable");
  assert.match(source, /role="status"/, "the prompt must be announced to assistive technology");
});

// --- precache safety boundary (P1) -------------------------------------------
//
// The Workbox precache manifest is a list of URLs the browser will cache and
// serve offline. `additionalManifestEntries` / `includeAssets` are the consumer
// escape hatches, and Workbox treats an entry as opaque: `blogs/first-post/` is
// as valid as `assets/app-1.js`, but it is a generated article page. These tests
// pin the rejection at config time; `test/pwa-build-guard.test.mjs` proves the
// same boundary on the *emitted* worker, where a transform can still inject an
// entry Folio never saw.

test("precache entries that name a generated page are rejected", () => {
  const config = { title: "PWA guard", description: "PWA guard site" };
  const iconList = [
    { src: "icon-192.png", sizes: "192x192" },
    { src: "icon-512.png", sizes: "512x512" },
  ];
  const rejects = (entry, pattern) =>
    assert.throws(
      () =>
        folioPwa({
          config,
          icons: iconList,
          workbox: { additionalManifestEntries: [entry] },
        }),
      pattern,
      `additionalManifestEntries ${JSON.stringify(entry)} must be rejected`,
    );

  // A page, however it is spelled.
  rejects("index.html", /names a generated page/);
  rejects("docs/hello/index.html", /names a generated page/);
  rejects("docs/hello/", /names a generated page/);
  rejects("blogs/first-post/", /names a generated page/);
  rejects("docs/index", /names a generated page/);
  rejects("404", /names a generated page/);
  // Percent-encoded, query-decorated and dot-segment aliases of the same page.
  rejects("docs%2Fhello%2F", /names a generated page/);
  rejects("docs/hello/index.html?cache=1", /names a generated page/);
  rejects("docs/hello/index.html#top", /names a generated page/);
  rejects("./assets/../docs/hello/index.html", /names a generated page/);
  rejects("docs/./hello/", /names a generated page/);
  // Escapes and cross-origin entries are never precacheable.
  rejects("../outside.js", /escapes the build output|outside the deployment scope/);
  rejects("https://cdn.example.com/app.js", /cross-origin/);
  rejects("//cdn.example.com/app.js", /cross-origin/);

  // `includeAssets` is validated the same way, with its own message.
  // `includeAssets` is glob-validated first, so a literal `.html` asset is
  // rejected there; the alias forms below never reach that rule and must still
  // be refused as pages.
  assert.throws(
    () => folioPwa({ config, icons: iconList, includeAssets: ["docs/hello/index.html"] }),
    /includeAssets may not precache HTML/,
  );
  assert.throws(
    () => folioPwa({ config, icons: iconList, includeAssets: ["docs/hello/"] }),
    /includeAssets contains .*names a generated page/,
  );
  assert.throws(
    () => folioPwa({ config, icons: iconList, includeAssets: ["**/*.html"] }),
    /may not precache HTML/,
  );
});

test("legitimate precache customization still works", () => {
  const config = { title: "PWA guard", description: "PWA guard site" };
  const plugins = folioPwa({
    config,
    icons: [
      { src: "icon-192.png", sizes: "192x192" },
      { src: "icon-512.png", sizes: "512x512" },
    ],
    includeAssets: ["fonts/inter.woff2", "img/hero.png", "favicon.svg"],
    workbox: {
      additionalManifestEntries: [
        "data/releases.json",
        { url: "files/guide.pdf", revision: "abc123" },
      ],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.example\.com\//,
          handler: "StaleWhileRevalidate",
        },
      ],
    },
  });
  assert.ok(Array.isArray(plugins) && plugins.length > 0);
  assert.ok(
    plugins.some((plugin) => plugin.name === "folio:pwa"),
    "the guard must not disable the integration itself",
  );
});

test("the emitted manifest icon list is validated, not just the input", () => {
  const config = { title: "PWA icons", description: "PWA icon site" };
  // Non-square: 192x256 satisfies "both sides big enough" but is not installable.
  assert.throws(
    () =>
      folioPwa({
        config,
        icons: [
          { src: "icon-192.png", sizes: "192x256" },
          { src: "icon-512.png", sizes: "512x512" },
        ],
      }),
    /non-square sizes .*192x256/,
  );
  // A square 256 icon covers 192 but not 512: still not installable.
  assert.throws(
    () => folioPwa({ config, icons: [{ src: "icon-256.png", sizes: "256x256" }] }),
    /at least 512x512/,
  );
  // Only a 192, no 512.
  assert.throws(
    () => folioPwa({ config, icons: [{ src: "icon-192.png", sizes: "192x192" }] }),
    /at least 512x512/,
  );
  // The generic manifest override may not replace the validated icon set.
  assert.throws(
    () =>
      folioPwa({
        config,
        icons: [
          { src: "icon-192.png", sizes: "192x192" },
          { src: "icon-512.png", sizes: "512x512" },
        ],
        manifest: { icons: [{ src: "sneaky.png", sizes: "1x1" }] },
      }),
    /manifest\.icons must not be overridden/,
  );
  // Valid square + maskable + SVG continues to work, and maskable survives.
  const plugins = folioPwa({
    config,
    icons: [
      { src: "icon-192.png", sizes: "192x192" },
      { src: "icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
      { src: "icon-maskable.png", sizes: "512x512", purpose: "maskable" },
    ],
  });
  assert.ok(Array.isArray(plugins) && plugins.length > 0);
});

// --- registration observability (P3) ----------------------------------------

test("the registration state collapses into exactly four observable values", () => {
  assert.equal(folioPwaRegistrationState({ supported: false }), "unsupported");
  // A browser without the API never reports "registering": nothing will happen.
  assert.equal(
    folioPwaRegistrationState({ supported: false, registered: true }),
    "unsupported",
  );
  assert.equal(folioPwaRegistrationState({ supported: true }), "registering");
  assert.equal(folioPwaRegistrationState({ supported: true, registered: true }), "registered");
  assert.equal(folioPwaRegistrationState({ supported: true, failed: true }), "failed");
  assert.equal(
    folioPwaRegistrationState({ supported: true, registered: true, failed: true }),
    "failed",
    "a failure must win over a stale success so the consumer sees the real outcome",
  );
});

test("the hook exposes the registration state without changing the existing API", () => {
  const source = readFileSync(join(packageRoot, "src/pwa-react.tsx"), "utf8");
  // The lifecycle stays upstream: no second `register()`/`skipWaiting` machine.
  assert.ok(
    !/navigator\.serviceWorker\.register\(/.test(source),
    "the hook must not register a worker itself; the official client owns that",
  );
  assert.ok(
    !/addEventListener\(\s*["'](?:waiting|installed|activated|controlling)["']/.test(source),
    "the hook must not subscribe to worker lifecycle events; that is the upstream client's state machine",
  );
  for (const name of ["supported", "registrationState", "registered"]) {
    assert.ok(source.includes(name), `the hook does not expose ${name}`);
  }
  for (const existing of ["needRefresh", "confirmUpdate", "dismissUpdate", "checkForUpdate", "offlineReady"]) {
    assert.ok(source.includes(existing), `the existing API lost ${existing}`);
  }
  const types = readFileSync(join(packageRoot, "dist/pwa-react.d.ts"), "utf8");
  for (const name of ["supported", "registrationState", "registered", "FolioPwaRegistrationState"]) {
    assert.ok(types.includes(name), `dist/pwa-react.d.ts is missing ${name}`);
  }
});
