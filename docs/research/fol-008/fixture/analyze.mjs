import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// FOL-008 对照分析：读取真实静态构建产物与真实浏览器（Chrome --dump-dom）
// 的 React 渲染结果，按导航项目导出可复核的链接表与结构检查。
//
// 用法：
//   node analyze.mjs --out dist-root --base / --dumps dumps-root --label root --json results/root.json

const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf("--" + name);
  return index >= 0 ? args[index + 1] : fallback;
}

const outDir = resolve(option("out", "dist-root"));
const base = option("base", "/");
const dumpDir = resolve(option("dumps", "dumps-root"));
const label = option("label", "root");
const jsonPath = option("json");

const ROUTES = [
  { route: "/", id: "home" },
  { route: "/docs/guide/intro", id: "intro" },
  { route: "/docs/guide/second", id: "second" },
  { route: "/docs/guide/third", id: "third" },
];

function staticFile(route) {
  return route === "/"
    ? join(outDir, "index.html")
    : join(outDir, route.slice(1), "index.html");
}

function dumpFile(route) {
  return join(dumpDir, route === "/" ? "index.html" : route.slice(1).replace(/\//g, "-") + ".html");
}

function read(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function text(fragment) {
  return decodeEntities(fragment.replace(/<[^>]*>/g, "")).trim();
}

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)="([^"]*)"/g)) {
    result[match[1]] = decodeEntities(match[2]);
  }
  return result;
}

function section(html, pattern) {
  const match = html?.match(pattern);
  return match ? match[1] : undefined;
}

function links(fragment) {
  if (!fragment) return [];
  return [...fragment.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((match) => ({
    ...attributes(match[1]),
    text: text(match[2]),
  }));
}

function extract(html) {
  const docnav = section(html, /<nav class="folio-docnav"[^>]*>([\s\S]*?)<\/nav>/);
  const toc = section(html, /<aside class="folio-toc"[^>]*>([\s\S]*?)<\/aside>/);
  const pager = section(html, /<nav class="folio-page-nav"[^>]*>([\s\S]*?)<\/nav>/);
  const headings = [...(html ?? "").matchAll(/<h([2-4])\b([^>]*)>([\s\S]*?)<\/h\1>/g)]
    .map((match) => ({
      depth: Number(match[1]),
      id: attributes(match[2]).id,
      text: text(match[3]),
    }))
    .filter((heading) => heading.id);

  const headingsMenu = section(
    html,
    /<nav class="folio-docnav"[^>]*>([\s\S]*?)<\/nav>/,
  );
  return {
    docnav: links(docnav).map((link) => ({
      href: link.href,
      text: link.text,
      active: link.class === "active" || "aria-current" in link,
    })),
    toc: links(toc).map((link) => ({ href: link.href, text: link.text })),
    pager: links(pager).map((link) => ({
      href: link.href,
      text: link.text,
      direction: (link.class ?? "").includes("previous") ? "previous" : "next",
    })),
    headings,
    allAnchors: links(html),
    hasDocnav: Boolean(docnav),
    hasToc: Boolean(toc),
    hasPager: Boolean(pager),
    headingsMenu: headingsMenu ? true : false,
  };
}

// 静态链接能否落到实际生成的 index.html：无 JS 导航是否“可走”。
function staticTarget(href) {
  if (!href || !href.startsWith("/")) return { ok: false, reason: "not root-absolute" };
  const basePrefix = base === "/" ? "" : base.replace(/\/$/, "");
  if (basePrefix && !href.startsWith(basePrefix + "/")) {
    return { ok: false, reason: `missing base prefix ${basePrefix}` };
  }
  if (basePrefix && href.startsWith(basePrefix + basePrefix)) {
    return { ok: false, reason: "double base prefix" };
  }
  const rest = href.slice(basePrefix.length);
  const withoutTrailing = rest.replace(/\/+$/, "");
  const file = withoutTrailing === "" ? "index.html" : withoutTrailing.slice(1) + "/index.html";
  return {
    ok: existsSync(join(outDir, file)),
    file,
    reason: existsSync(join(outDir, file)) ? undefined : "no generated file for href",
  };
}

const pages = [];
for (const { route, id } of ROUTES) {
  const staticHtml = read(staticFile(route));
  const reactHtml = read(dumpFile(route));
  const staticData = staticHtml ? extract(staticHtml) : null;
  const reactData = reactHtml ? extract(reactHtml) : null;
  const hydrated = reactHtml ? /data-folio-react="rendered"/.test(reactHtml) : false;

  pages.push({
    route,
    id,
    staticHtml: staticFile(route),
    reactDump: dumpFile(route),
    static: staticData,
    react: reactData ? { ...reactData, hydrated } : null,
    staticTargets: staticData
      ? [...staticData.docnav, ...staticData.pager].map((link) => ({
          href: link.href,
          ...staticTarget(link.href),
        }))
      : [],
    tocResolution: staticData
      ? staticData.toc.map((link) => ({
          href: link.href,
          id: link.href.replace(/^#/, ""),
          existsInBody: staticData.headings.some(
            (heading) => heading.id === link.href.replace(/^#/, ""),
          ),
        }))
      : [],
    reactTocResolution: reactData
      ? reactData.toc.map((link) => ({
          href: link.href,
          id: link.href.replace(/^#/, ""),
          existsInBody: reactData.headings.some(
            (heading) => heading.id === link.href.replace(/^#/, ""),
          ),
        }))
      : [],
    duplicateIds: {
      static: staticData ? duplicates(staticData.headings.map((heading) => heading.id)) : [],
      react: reactData ? duplicates(reactData.headings.map((heading) => heading.id)) : [],
    },
  });
}

function duplicates(values) {
  const seen = new Set();
  const duplicated = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicated.add(value);
    seen.add(value);
  }
  return [...duplicated];
}

const report = {
  label,
  base,
  outDir,
  dumpDir,
  generatedAt: new Date().toISOString(),
  pages,
  checks: {
    home: pages[0],
    intro: pages[1],
  },
};

const serialized = JSON.stringify(report, null, 2);
console.log(serialized);
if (jsonPath) {
  writeFileSync(resolve(jsonPath), serialized + "\n", "utf8");
  console.error(`wrote ${jsonPath}`);
}
