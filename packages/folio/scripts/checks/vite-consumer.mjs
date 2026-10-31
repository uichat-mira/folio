// T3 runtime check: build a minimal Vite + React application that only consumes
// the installed tarball. It imports the public plugin entry, imports the
// virtual content module, and must carry one known Markdown document into the
// client bundle.
//
// Failures are staged so a red run says where it broke:
//   [plugin]         the Vite config could not import @uichat-mira/folio/vite
//   [virtual-module] "virtual:folio/content" could not be resolved
//   [build]          Vite failed for another reason, or produced no assets
//   [content]        the build succeeded but the Markdown did not reach the bundle
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const MARKER_PLACEHOLDER = "{{FOLIO_CONSUMER_MARKER}}";
const KNOWN_TITLE = "Consumer discovery fixture";

function classifyBuildFailure(result) {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (/failed to resolve import ["']virtual:folio\/content["']/i.test(output)) {
    return "virtual-module";
  }
  if (
    /failed to resolve import ["']@uichat-mira\/folio\/vite["']/i.test(output) ||
    /failed to load .*vite\.config/i.test(output) ||
    /cannot find package ["']@uichat-mira\/folio/i.test(output)
  ) {
    return "plugin";
  }
  return "build";
}

function buildFailure(result) {
  const stage = classifyBuildFailure(result);
  return new Error(
    `[${stage}] FAIL vite build exited with code ${result.status}\n` +
      `--- stdout ---\n${(result.stdout ?? "").trim()}\n` +
      `--- stderr ---\n${(result.stderr ?? "").trim()}`,
  );
}

function bundleFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return bundleFiles(path);
    return /\.(m?js)$/.test(entry.name) ? [path] : [];
  });
}

function readBundle(directory) {
  const files = bundleFiles(directory);
  return {
    files,
    text: files.map((file) => readFileSync(file, "utf8")).join("\n"),
  };
}

export function verifyViteConsumer({ consumerDir, fixtureDir, log }) {
  const appDir = join(consumerDir, "vite-app");
  cpSync(fixtureDir, appDir, { recursive: true });

  // A per-run marker makes the content assertion impossible to satisfy with an
  // incidental static string: this token only exists in the Markdown file.
  const marker = `FOLIO_CONSUMER_${randomBytes(8).toString("hex")}`;
  const markdownPath = join(appDir, "content", "docs", "hello.md");
  const markdown = readFileSync(markdownPath, "utf8");
  assert.ok(
    markdown.includes(MARKER_PLACEHOLDER),
    `[fixture] FAIL ${markdownPath} has no ${MARKER_PLACEHOLDER} placeholder`,
  );
  writeFileSync(markdownPath, markdown.replaceAll(MARKER_PLACEHOLDER, marker));

  const viteCli = join(consumerDir, "node_modules", "vite", "bin", "vite.js");
  assert.ok(
    existsSync(viteCli),
    `[install] FAIL the consumer installation has no Vite CLI at ${viteCli}`,
  );

  const runBuild = (outDir, contentDir) =>
    spawnSync(process.execPath, [viteCli, "build", "--logLevel", "warn"], {
      cwd: appDir,
      encoding: "utf8",
      timeout: 300_000,
      env: {
        ...process.env,
        FOLIO_CONSUMER_OUT_DIR: outDir,
        FOLIO_CONSUMER_CONTENT_DIR: contentDir,
      },
    });

  const positive = runBuild("dist", "content");
  if (positive.status !== 0) throw buildFailure(positive);
  log(`[build]    ok  vite build (staticRoutes: false) wrote ${join(appDir, "dist")}`);

  const indexHtml = readFileSync(join(appDir, "dist", "index.html"), "utf8");
  assert.ok(
    /<script[^>]+type="module"/.test(indexHtml),
    "[build] FAIL the built index.html has no module script",
  );

  const positiveBundle = readBundle(join(appDir, "dist"));
  assert.ok(
    positiveBundle.files.length > 0,
    "[build] FAIL vite build produced no JavaScript assets",
  );
  assert.ok(
    positiveBundle.text.includes(marker),
    `[content] FAIL discovery marker ${marker} is missing from the client bundle`,
  );
  assert.ok(
    positiveBundle.text.includes(KNOWN_TITLE),
    `[content] FAIL the Markdown title "${KNOWN_TITLE}" is missing from the client bundle`,
  );
  log(
    `[content]  ok  ${marker} and "${KNOWN_TITLE}" reached the client bundle (${positiveBundle.files.length} JS assets)`,
  );

  // Negative control: with no discoverable Markdown the build must still
  // succeed, and the marker must be gone. If the marker survives, the positive
  // assertion was not proving content discovery.
  const negative = runBuild("dist-negative", "content-absent");
  if (negative.status !== 0) throw buildFailure(negative);
  const negativeBundle = readBundle(join(appDir, "dist-negative"));
  assert.ok(
    negativeBundle.files.length > 0,
    "[build] FAIL the negative control build produced no JavaScript assets",
  );
  assert.ok(
    !negativeBundle.text.includes(marker),
    `[content] FAIL marker ${marker} survived a build without Markdown; the content assertion does not prove discovery`,
  );
  log(
    `[content]  ok  negative control without Markdown built and contains no marker`,
  );

  // The prepared app directory is handed back so the static-output check can
  // build the same fixture in the same installation instead of copying it
  // again and paying for another install.
  return { appDir };
}
