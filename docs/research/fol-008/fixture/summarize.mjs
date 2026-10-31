import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// 打印 FOL-008 对照结果的可读摘要；完整事实见 results/*.json。
const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: node summarize.mjs results/root.json [results/pages.json]");
  process.exit(1);
}

for (const file of files) {
  const report = JSON.parse(readFileSync(resolve(file), "utf8"));
  console.log(`\n===== ${report.label} (base=${report.base}) =====`);
  for (const page of report.pages) {
    console.log(`\n-- ${page.route}`);
    console.log("  static docnav:", JSON.stringify(page.static.docnav));
    console.log("  react  docnav:", JSON.stringify(page.react.docnav));
    console.log("  static toc   :", JSON.stringify(page.static.toc));
    console.log("  react  toc   :", JSON.stringify(page.react.toc));
    console.log("  static pager :", JSON.stringify(page.static.pager));
    console.log("  react  pager :", JSON.stringify(page.react.pager));
    console.log("  static heading ids:", JSON.stringify(page.static.headings.map((h) => h.id)));
    console.log("  react  heading ids:", JSON.stringify(page.react.headings.map((h) => h.id)));
    console.log(
      "  static toc misses body:",
      JSON.stringify(page.tocResolution.filter((item) => !item.existsInBody)),
    );
    console.log(
      "  react  toc misses body:",
      JSON.stringify(page.reactTocResolution.filter((item) => !item.existsInBody)),
    );
    console.log("  duplicate ids:", JSON.stringify(page.duplicateIds));
    console.log(
      "  static nav targets that do not resolve:",
      JSON.stringify(page.staticTargets.filter((item) => !item.ok)),
    );
    console.log("  react hydrated:", page.react.hydrated);
  }
}
