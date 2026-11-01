// Deterministic CSS aggregation for the single public stylesheet entry
// (FOL-020, Issue #111).
//
// `dist/styles.css` is produced by concatenating `styles/manifest.mjs` in
// manifest order. Nothing is minified, prefixed, wrapped or rewritten, and no
// separator comment is injected: the source bytes are preserved, so a
// single-source manifest yields a file that is byte-identical to its source.
// Multi-source output is the sources joined by exactly one blank line, using
// the line ending of the preceding source, which keeps the cascade order equal
// to the manifest order.
//
// Adding a component stylesheet is therefore a manifest entry, never an
// `@import` and never a new toolchain.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { STYLE_SOURCES } from "../styles/manifest.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));

/** Package root (`packages/folio`), resolved from this script's location. */
export const packageRoot = resolve(scriptDir, "..");

/** `dist/styles.css` relative to the package root. */
export const DEFAULT_OUT_FILE = "dist/styles.css";

function detectEol(text) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function readSource(root, relative, index) {
  if (typeof relative !== "string" || relative.trim() === "") {
    throw new Error(
      `styles/manifest.mjs entry #${index + 1} is not a package-relative path: ${JSON.stringify(relative)}`,
    );
  }
  const file = resolve(root, relative);
  try {
    return { relative, file, text: readFileSync(file, "utf8") };
  } catch (error) {
    throw new Error(
      `styles/manifest.mjs entry #${index + 1} (${relative}) could not be read from ${file}: ${error.message}`,
    );
  }
}

/**
 * Aggregate the ordered CSS sources without modifying their bytes.
 *
 * @param {object} [options]
 * @param {string} [options.packageRoot] package root used to resolve sources
 * @param {string[]} [options.sources] ordered package-relative sources
 * @returns {{ css: string, sources: { relative: string, file: string, text: string }[] }}
 */
export function aggregateStyles({
  packageRoot: root = packageRoot,
  sources = STYLE_SOURCES,
} = {}) {
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error(
      "styles/manifest.mjs must list at least one package-relative CSS source",
    );
  }

  const duplicates = sources.filter(
    (source, index) => sources.indexOf(source) !== index,
  );
  if (duplicates.length > 0) {
    throw new Error(
      `styles/manifest.mjs lists duplicate source(s): ${[...new Set(duplicates)].join(", ")}`,
    );
  }

  const resolved = sources.map((relative, index) =>
    readSource(root, relative, index),
  );

  let css = "";
  for (const [index, source] of resolved.entries()) {
    if (index === 0) {
      css = source.text;
      continue;
    }
    const eol = detectEol(resolved[index - 1].text);
    // Exactly one blank line between files, so the boundary is visible in the
    // published stylesheet without injecting a comment into the cascade.
    if (!css.endsWith(eol)) css += eol;
    if (!css.endsWith(`${eol}${eol}`)) css += eol;
    css += source.text;
  }

  return { css, sources: resolved };
}

/**
 * Write the aggregated stylesheet to `dist/styles.css` (or another out file).
 *
 * @param {object} [options]
 * @param {string} [options.packageRoot]
 * @param {string} [options.outFile] package-relative output path
 * @param {string[]} [options.sources]
 */
export function writeAggregatedStyles({
  packageRoot: root = packageRoot,
  outFile = DEFAULT_OUT_FILE,
  sources = STYLE_SOURCES,
} = {}) {
  const { css, sources: resolved } = aggregateStyles({
    packageRoot: root,
    sources,
  });
  const target = resolve(root, outFile);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, css);
  return {
    target,
    bytes: Buffer.byteLength(css),
    sources: resolved.map((source) => source.relative),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = writeAggregatedStyles();
  const relativeTarget = result.target.slice(packageRoot.length + 1);
  console.log(
    `aggregated ${result.sources.length} CSS source(s) into ${relativeTarget.replace(/\\/g, "/")}: ${result.bytes} bytes`,
  );
  for (const [index, source] of result.sources.entries()) {
    console.log(`  ${index + 1}. ${source}`);
  }
}
