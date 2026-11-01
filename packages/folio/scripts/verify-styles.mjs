// FOL-020 (Issue #111) stylesheet gate: the aggregated `dist/styles.css` must
// be produced from `styles/manifest.mjs` and must still contain the frozen
// token block, the five global rules, and the component/static class rules
// that React and static HTML share, in a cascade order that keeps tokens first.
//
// `npm run pack:verify` calls `verifyStylesheet()` so the check cannot be
// bypassed by a single card, and the script is also a CLI:
//
//   node scripts/verify-styles.mjs                 # verify dist/styles.css
//   node scripts/verify-styles.mjs --file <css>    # verify any stylesheet
//   node scripts/verify-styles.mjs --self-test     # prove the gate rejects
//                                                  # controlled regressions
//
// Failures are collected, not thrown on the first one, so a red run lists every
// broken invariant. `--self-test` mutates a copy of the built stylesheet,
// re-runs this gate as a child process, and requires a non-zero exit plus the
// expected stage id for each scenario (deleted component rule, reordered
// tokens, removed token, removed global rule, moved component block, truncated
// file). Those scenarios are the reproducible negative evidence for this card.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  DEFAULT_OUT_FILE,
  aggregateStyles,
  packageRoot as defaultPackageRoot,
} from "./build-styles.mjs";
import { STYLE_SOURCES } from "../styles/manifest.mjs";
import {
  CASCADE_ORDER,
  DARK_TOKEN_ORDER,
  GLOBAL_RULES,
  REQUIRED_DECLARATIONS,
  REQUIRED_SELECTOR_FAMILIES,
  ROOT_TOKEN_ORDER,
  TOKEN_SAMPLE_VALUES,
} from "../styles/contract.mjs";

const scriptPath = fileURLToPath(import.meta.url);

// Comments are masked with spaces instead of removed so every rule offset from
// scanRules() stays valid in the original text (the negative scenarios slice
// rule blocks out of the real stylesheet by those offsets).
function maskComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\r\n]/g, " "),
  );
}

/**
 * Minimal CSS block scanner: records every rule (top level and inside
 * at-rules) with its selector prelude, body and byte span. Enough to assert
 * selector presence and order without pulling in a parser dependency.
 */
function scanRules(css) {
  const rules = [];
  const stack = [];
  let preludeStart = 0;
  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    if (char === "{") {
      stack.push({
        prelude: css.slice(preludeStart, index).trim(),
        start: preludeStart,
        bodyStart: index + 1,
      });
      preludeStart = index + 1;
    } else if (char === "}") {
      const frame = stack.pop();
      if (!frame) return { rules, balanced: false, rest: "" };
      rules.push({
        prelude: frame.prelude,
        body: css.slice(frame.bodyStart, index),
        start: frame.start,
        end: index + 1,
        depth: stack.length,
      });
      preludeStart = index + 1;
    } else if (char === ";") {
      preludeStart = index + 1;
    }
  }
  return {
    rules,
    balanced: stack.length === 0,
    rest: css.slice(preludeStart).trim(),
  };
}

function normalizeSelector(selector) {
  return selector
    .replace(/\s+/g, " ")
    .replace(/\s*([>+~])\s*/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSelectorList(prelude) {
  const selectors = [];
  let current = "";
  let depth = 0;
  for (const char of prelude) {
    if (char === "(" || char === "[") depth += 1;
    if (char === ")" || char === "]") depth -= 1;
    if (char === "," && depth === 0) {
      selectors.push(normalizeSelector(current));
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim() !== "") selectors.push(normalizeSelector(current));
  return selectors;
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

function ruleIndexMap(rules) {
  const map = new Map();
  rules.forEach((rule, index) => {
    if (rule.prelude.startsWith("@")) return;
    for (const selector of splitSelectorList(rule.prelude)) {
      if (!map.has(selector)) map.set(selector, index);
    }
  });
  return map;
}

/**
 * Exact selector index of a stylesheet (normalized selector -> first rule
 * index). Exported so the tarball consumer check can assert that a Vite-built,
 * minified CSS asset still contains a selector as a real rule, instead of
 * matching a substring that `.folio-header__wrap` would also satisfy.
 */
export function selectorIndex(css) {
  const { rules } = scanRules(maskComments(css));
  return ruleIndexMap(rules);
}

function findRule(rules, selectors) {  for (const rule of rules) {
    if (rule.prelude.startsWith("@")) continue;
    const list = splitSelectorList(rule.prelude);
    if (
      list.length === selectors.length &&
      selectors.every((selector, index) => list[index] === selector)
    ) {
      return rule;
    }
  }
  return undefined;
}

function findFirstRuleWithSelector(rules, selector) {
  return rules.find(
    (rule) =>
      !rule.prelude.startsWith("@") &&
      splitSelectorList(rule.prelude).includes(selector),
  );
}

function tokenNames(body) {
  return [...body.matchAll(/(--folio-[\w-]+)\s*:/g)].map((match) => match[1]);
}

function tokenValue(body, name) {
  const pattern = new RegExp(`(?:^|;)\\s*${name.replace(/[-]/g, "\\-")}\\s*:\\s*([^;]+);`);
  const match = body.match(pattern);
  return match ? normalizeWhitespace(match[1]) : undefined;
}

function firstDifference(expected, actual) {
  const limit = Math.min(expected.length, actual.length);
  for (let index = 0; index < limit; index += 1) {
    if (expected[index] !== actual[index]) return index;
  }
  return expected.length === actual.length ? -1 : limit;
}

function describeDifference(expected, actual, offset) {
  const start = Math.max(0, offset - 40);
  const context = (text) => JSON.stringify(text.slice(start, offset + 60));
  return `first difference at offset ${offset}: expected ${context(expected)} but found ${context(actual)}`;
}

/**
 * Verify a stylesheet against the manifest and the frozen CSS contract.
 *
 * @param {object} [options]
 * @param {string} [options.packageRoot]
 * @param {string} [options.file] stylesheet to verify (package-relative or absolute)
 * @param {string[]} [options.sources]
 * @returns {{ failures: { id: string, message: string }[], target: string, bytes: number, sources: string[] }}
 */
export function verifyStylesheet({
  packageRoot: root = defaultPackageRoot,
  file = DEFAULT_OUT_FILE,
  sources = STYLE_SOURCES,
} = {}) {
  const failures = [];
  const fail = (id, message) => failures.push({ id, message });
  const target = resolve(root, file);

  if (!existsSync(target)) {
    fail(
      "manifest",
      `stylesheet ${target} does not exist; run \`npm run build\` (or \`node scripts/build-styles.mjs\`) first`,
    );
    return { failures, target, bytes: 0, sources: [] };
  }
  const actual = readFileSync(target, "utf8");

  // 1. The manifest itself: ordered, non-empty, unique, readable.
  let aggregation;
  try {
    aggregation = aggregateStyles({ packageRoot: root, sources });
  } catch (error) {
    fail("manifest", error.message);
    return { failures, target, bytes: Buffer.byteLength(actual), sources: [] };
  }
  if (sources.length !== new Set(sources).size) {
    fail("manifest", "styles/manifest.mjs lists a source more than once");
  }
  if (sources[0] !== "src/styles.css") {
    fail(
      "manifest",
      `the first source must remain src/styles.css (tokens and global rules first), found ${JSON.stringify(sources[0])}`,
    );
  }

  // 2. The file must be exactly a fresh aggregation of the manifest.
  if (actual !== aggregation.css) {
    const offset = firstDifference(aggregation.css, actual);
    fail(
      "aggregate",
      `${target} is not the ordered aggregation of styles/manifest.mjs (${aggregation.sources.length} source(s), expected ${Buffer.byteLength(aggregation.css)} bytes, found ${Buffer.byteLength(actual)} bytes); ${describeDifference(aggregation.css, actual, offset)}. Rebuild with \`npm run build\`.`,
    );
  }

  // 3. Single-source equivalence: byte-identical to the registered source.
  if (sources.length === 1) {
    const sourceText = aggregation.sources[0].text;
    if (actual !== sourceText) {
      const offset = firstDifference(sourceText, actual);
      fail(
        "aggregate:single-source",
        `with a single manifest source ${target} must be byte-identical to ${sources[0]}; ${describeDifference(sourceText, actual, offset)}`,
      );
    }
  }

  // 4. Aggregation boundaries: each source appears in manifest order.
  let cursor = 0;
  for (const [index, source] of aggregation.sources.entries()) {
    const position = actual.indexOf(source.text, cursor);
    if (position < 0) {
      fail(
        "sources:order",
        `manifest source #${index + 1} (${source.relative}) is not present after the previous source; the published cascade order does not match styles/manifest.mjs`,
      );
      break;
    }
    cursor = position + source.text.length;
  }

  // 5. Structural sanity of the concatenated stylesheet.
  const masked = maskComments(actual);
  const { rules, balanced, rest } = scanRules(masked);
  if (!balanced) {
    fail("parse", `${target} has unbalanced braces; the aggregated stylesheet is truncated or malformed`);
  }
  if (rest !== "") {
    fail("parse", `${target} has trailing content after the last rule: ${JSON.stringify(rest.slice(0, 80))}`);
  }
  if (/@import\b/.test(masked)) {
    fail(
      "parse",
      `${target} contains @import; the stylesheet must be one aggregated file, not an import graph`,
    );
  }
  const emptySelectors = rules.filter(
    (rule) => !rule.prelude.startsWith("@") && rule.prelude.trim() === "",
  );
  if (emptySelectors.length > 0) {
    fail("parse", `${target} has ${emptySelectors.length} rule(s) without a selector`);
  }

  const indexOf = ruleIndexMap(rules);

  // 6. Token block: exact names in exact order.
  const rootRule = findRule(rules, [":root"]);
  if (!rootRule) {
    fail("tokens:root", `${target} has no :root rule; the --folio-* token block is missing`);
  } else {
    const names = tokenNames(rootRule.body);
    const mismatch = ROOT_TOKEN_ORDER.findIndex((name, index) => names[index] !== name);
    if (names.length !== ROOT_TOKEN_ORDER.length || mismatch !== -1) {
      fail(
        "tokens:root",
        `:root token declarations do not match the frozen contract (expected ${ROOT_TOKEN_ORDER.length} in order, found ${names.length}); first mismatch at position ${mismatch === -1 ? names.length : mismatch}: expected ${JSON.stringify(ROOT_TOKEN_ORDER[mismatch === -1 ? names.length : mismatch])}, found ${JSON.stringify(names[mismatch === -1 ? names.length : mismatch])}`,
      );
    }
    for (const [name, expected] of Object.entries(TOKEN_SAMPLE_VALUES)) {
      const value = tokenValue(rootRule.body, name);
      if (value !== expected) {
        fail(
          "tokens:values",
          `:root declares ${name}: ${value ?? "<missing>"}, expected ${expected}`,
        );
      }
    }
  }

  const darkRule = findRule(rules, ['[data-folio-theme="dark"]']);
  if (!darkRule) {
    fail(
      "tokens:dark",
      `${target} has no [data-folio-theme="dark"] rule; the dark theme token overrides are missing`,
    );
  } else {
    const names = tokenNames(darkRule.body);
    const mismatch = DARK_TOKEN_ORDER.findIndex((name, index) => names[index] !== name);
    if (names.length !== DARK_TOKEN_ORDER.length || mismatch !== -1) {
      fail(
        "tokens:dark",
        `[data-folio-theme="dark"] overrides do not match the frozen contract (expected ${DARK_TOKEN_ORDER.length} in order, found ${names.length}); first mismatch at position ${mismatch === -1 ? names.length : mismatch}`,
      );
    }
  }

  // 7. The five global rules and their load-bearing declarations.
  for (const globalRule of GLOBAL_RULES) {
    const rule = findRule(rules, globalRule.selectors);
    if (!rule) {
      fail(
        "globals",
        `${target} is missing the global rule ${globalRule.selectors.join(", ")} (${globalRule.id})`,
      );
      continue;
    }
    for (const declaration of globalRule.declarations ?? []) {
      if (!normalizeWhitespace(rule.body).includes(normalizeWhitespace(declaration))) {
        fail(
          "globals",
          `global rule ${globalRule.selectors.join(", ")} (${globalRule.id}) no longer declares ${declaration}`,
        );
      }
    }
  }

  // 8. Component and static class rules: exact selectors, not substrings, plus
  // the load-bearing declaration of each representative canonical rule.
  for (const family of REQUIRED_SELECTOR_FAMILIES) {
    const missing = family.selectors.filter((selector) => !indexOf.has(selector));
    if (missing.length > 0) {
      fail(
        `selectors:${family.id}`,
        `${target} is missing ${missing.length} ${family.id} selector rule(s): ${missing.join(", ")}`,
      );
    }
    const weakened = family.selectors
      .filter((selector) => REQUIRED_DECLARATIONS[selector] !== undefined)
      .map((selector) => ({
        selector,
        rule: findFirstRuleWithSelector(rules, selector),
        expected: REQUIRED_DECLARATIONS[selector],
      }))
      .filter(
        ({ rule, expected }) =>
          rule !== undefined &&
          !normalizeWhitespace(rule.body).includes(normalizeWhitespace(expected)),
      );
    for (const { selector, expected } of weakened) {
      fail(
        `selectors:${family.id}`,
        `${target} no longer declares the canonical ${selector} rule (missing ${expected}); the ${family.id} component rule was deleted or emptied`,
      );
    }
  }

  // 9. Cascade order: tokens first, then the component families in order.
  for (const [before, after] of CASCADE_ORDER) {
    const beforeIndex = indexOf.get(before);
    const afterIndex = indexOf.get(after);
    if (beforeIndex === undefined || afterIndex === undefined) continue;
    if (beforeIndex > afterIndex) {
      fail(
        "order:cascade",
        `cascade order changed: ${before} (rule #${beforeIndex}) must precede ${after} (rule #${afterIndex})`,
      );
    }
  }

  return {
    failures,
    target,
    bytes: Buffer.byteLength(actual),
    sources: aggregation.sources.map((source) => source.relative),
  };
}

function printFailures(failures) {
  for (const failure of failures) {
    console.error(`[${failure.id}] FAIL ${failure.message}`);
  }
}

// --- controlled negative scenarios (reproducible evidence for FOL-020) ------

function ruleSpan(css, selector) {
  const { rules } = scanRules(maskComments(css));
  const rule = rules.find(
    (candidate) =>
      !candidate.prelude.startsWith("@") &&
      splitSelectorList(candidate.prelude).includes(selector),
  );
  return rule;
}

function removeRule(css, selector) {
  const rule = ruleSpan(css, selector);
  if (!rule) throw new Error(`negative scenario: no rule for ${selector}`);
  return css.slice(0, rule.start) + css.slice(rule.end);
}

function moveRuleToEnd(css, selector) {
  const rule = ruleSpan(css, selector);
  if (!rule) throw new Error(`negative scenario: no rule for ${selector}`);
  const block = css.slice(rule.start, rule.end);
  return `${css.slice(0, rule.start)}${css.slice(rule.end)}\n${block}\n`;
}

const NEGATIVE_SCENARIOS = [
  {
    id: "delete-docs-shell-rule",
    expect: "selectors:docs-shell",
    what: "delete the .folio-docs-shell component rule",
    mutate: (css) => removeRule(css, ".folio-docs-shell"),
  },
  {
    id: "delete-markdown-rule",
    expect: "selectors:markdown",
    what: "delete the .folio-markdown component rule",
    mutate: (css) => removeRule(css, ".folio-markdown"),
  },
  {
    id: "reorder-root-tokens",
    expect: "tokens:root",
    what: "swap --folio-primary and --folio-ink in :root",
    mutate: (css) =>
      css
        .replace("--folio-primary: #cc785c;", "@@folio-swap@@")
        .replace("--folio-ink: #141413;", "--folio-primary: #cc785c;")
        .replace("@@folio-swap@@", "--folio-ink: #141413;"),
  },
  {
    id: "remove-root-token",
    expect: "tokens:root",
    what: "delete the --folio-hairline-soft token declaration",
    mutate: (css) => css.replace("--folio-hairline-soft: #ebe6df;", ""),
  },
  {
    id: "remove-global-rule",
    expect: "globals",
    what: "delete the global * { box-sizing: border-box } rule",
    mutate: (css) => removeRule(css, "*"),
  },
  {
    id: "move-markdown-block-after-docs-shell",
    expect: "order:cascade",
    what: "move the .folio-markdown rule block to the end of the stylesheet",
    mutate: (css) => moveRuleToEnd(css, ".folio-markdown"),
  },
  {
    id: "truncate-stylesheet",
    expect: "parse",
    what: "drop the final closing brace",
    mutate: (css) => css.replace(/\}\s*$/, "\n"),
  },
];

function runSelfTest() {
  const baseline = verifyStylesheet({});
  if (baseline.failures.length > 0) {
    console.error(
      "styles.css self-test cannot run: the baseline stylesheet already fails the gate. Build first (`npm run build`) and fix the failures below.",
    );
    printFailures(baseline.failures);
    return 1;
  }
  console.log(
    `[selftest] ok  baseline ${baseline.target} passes every content check (${baseline.bytes} bytes, ${baseline.sources.length} source(s))`,
  );

  const baselineCss = readFileSync(baseline.target, "utf8");
  const tempDir = mkdtempSync(resolve(tmpdir(), "folio-styles-selftest-"));
  let failures = 0;
  try {
    for (const scenario of NEGATIVE_SCENARIOS) {
      const mutated = scenario.mutate(baselineCss);
      if (mutated === baselineCss) {
        console.error(
          `[selftest] FAIL ${scenario.id}: the mutation did not change the stylesheet, so the scenario proves nothing`,
        );
        failures += 1;
        continue;
      }
      const mutatedPath = resolve(tempDir, `${scenario.id}.css`);
      writeFileSync(mutatedPath, mutated);
      const result = spawnSync(process.execPath, [scriptPath, "--file", mutatedPath], {
        encoding: "utf8",
        timeout: 300_000,
      });
      const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
      const expected = `[${scenario.expect}] FAIL`;
      if (result.status === 0 || !output.includes(expected)) {
        console.error(
          `[selftest] FAIL ${scenario.id}: expected a non-zero exit with ${expected} after "${scenario.what}", got exit ${result.status}`,
        );
        console.error(output.trim());
        failures += 1;
        continue;
      }
      const line = output
        .split("\n")
        .find((candidate) => candidate.includes(expected))
        .trim();
      console.log(
        `[selftest] ok  ${scenario.id}: exit ${result.status}, ${line}`,
      );
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }

  if (failures > 0) {
    console.error(
      `\nstyles.css self-test failed: ${failures}/${NEGATIVE_SCENARIOS.length} negative control(s) did not fail the gate`,
    );
    return 1;
  }
  console.log(
    `\nstyles.css self-test passed: ${NEGATIVE_SCENARIOS.length}/${NEGATIVE_SCENARIOS.length} controlled regressions were rejected by the gate`,
  );
  return 0;
}

function main(argv) {
  const args = argv.slice(2);
  if (args.includes("--self-test")) return runSelfTest();

  const fileIndex = args.indexOf("--file");
  const file = fileIndex >= 0 ? args[fileIndex + 1] : undefined;
  if (fileIndex >= 0 && (file === undefined || file.startsWith("--"))) {
    console.error("--file requires a stylesheet path");
    return 2;
  }

  const report = verifyStylesheet(file === undefined ? {} : { file });
  if (report.failures.length > 0) {
    printFailures(report.failures);
    console.error(
      `\nstyles.css gate failed with ${report.failures.length} problem(s) in ${report.target}`,
    );
    return 1;
  }
  console.log(
    `[styles] ok  ${report.target}: ${report.bytes} bytes from ${report.sources.length} source(s); tokens, global rules, component/static selectors and cascade order verified`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv);
}
