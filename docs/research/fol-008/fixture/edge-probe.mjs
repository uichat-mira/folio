import { writeFileSync } from "node:fs";
import { extractHeadings, parseFolioDoc, renderFolioMarkdown } from "@uichat-mira/folio";

// 附加边界探测：TOC 的 id 来自 extractHeadings（原始 Markdown），正文 heading id
// 来自 renderFolioMarkdown（marked 渲染后的 HTML）。这里比较两条流水线在同一标题
// 上的结果，判断 TOC 锚点是否总能命中正文。不属于三篇主对照语料，单独记录。
const samples = [
  ["plain", "## 普通标题\n\n正文"],
  ["inline-code", "## 安装 `@uichat-mira/folio`\n\n正文"],
  ["emphasis", "## Hello *World*\n\n正文"],
  ["markdown-link", "## [链接标题](https://example.com)\n\n正文"],
  ["entity-amp", "## FAQ & 支持\n\n正文"],
  ["inline-html", "## 标题带 <span>内联</span> HTML\n\n正文"],
  ["duplicate", "## 重复\n\n## 重复\n\n正文"],
  ["explicit-html", '<h2 id="explicit-x">显式标题</h2>\n\n正文'],
  ["clipboard", "## 剪贴板 Title\n\n正文"],
];

const results = [];
for (const [id, body] of samples) {
  const headings = extractHeadings(body);
  const html = renderFolioMarkdown(body, { removeH1: true });
  const rendered = [...html.matchAll(/<h([2-4])\b([^>]*)>([\s\S]*?)<\/h\1>/g)]
    .map((match) => ({
      depth: Number(match[1]),
      id: (match[2].match(/\bid="([^"]+)"/) ?? [])[1],
      text: match[3].replace(/<[^>]*>/g, "").trim(),
    }));

  const tocHrefs = headings.map((heading) => "#" + heading.id);
  const renderedIds = new Set(rendered.map((heading) => heading.id));
  results.push({
    sample: id,
    body,
    toc: headings.map((heading) => ({ depth: heading.depth, id: heading.id, text: heading.text })),
    rendered,
    tocTargetsMissing: tocHrefs.filter((href) => !renderedIds.has(href.slice(1))),
  });
}

// 顺带确认 parseFolioDoc 走的是同一条 extractHeadings 流水线。
const doc = parseFolioDoc("docs/probe.md", "---\ntitle: Probe\n---\n\n## A\n");

const report = {
  generatedAt: new Date().toISOString(),
  results,
  parsedHeadings: doc.headings,
};
const jsonIndex = process.argv.indexOf("--json");
if (jsonIndex >= 0 && process.argv[jsonIndex + 1]) {
  writeFileSync(process.argv[jsonIndex + 1], JSON.stringify(report, null, 2) + "\n", "utf8");
}
console.log(JSON.stringify(report, null, 2));
