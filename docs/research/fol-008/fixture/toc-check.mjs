import { readFileSync } from "node:fs";

// 检查一份 HTML（静态产物或浏览器 dump）里的 TOC href 是否都能命中正文 heading id。
// 用法：node toc-check.mjs <file.html> [...]
for (const file of process.argv.slice(2)) {
  const html = readFileSync(file, "utf8");
  const ids = [...html.matchAll(/<h([2-4])\b[^>]*\bid="([^"]+)"/g)].map((match) => match[2]);
  const toc = [...html.matchAll(/<aside class="folio-toc"[\s\S]*?<\/aside>/g)];
  const hrefs = toc.length
    ? [...toc[0][0].matchAll(/href="#([^"]+)"/g)].map((match) => match[1])
    : [];
  const missing = hrefs.filter((href) => !ids.includes(href));
  console.log(
    JSON.stringify(
      {
        file,
        headings: ids.length,
        tocEntries: hrefs.length,
        tocMissing: missing,
        firstIds: ids.slice(0, 8),
        firstHrefs: hrefs.slice(0, 8),
      },
      null,
      2,
    ),
  );
}
