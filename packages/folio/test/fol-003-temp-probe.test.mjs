// Temporary FOL-003 research evidence probe, removed before final PR.
// Intentionally describes unsafe CURRENT behavior, not a safe-output contract.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FolioMarkdown, renderFolioMarkdown } from "../dist/index.js";
import { writeFolioStaticSite } from "../dist/vite.js";

const raw = '<img src=x onerror="window.__folio_probe=1">';
const fenceMarker = String.fromCharCode(96).repeat(3);
const vectors = {
  raw,
  directive: "::: html\n" + raw + "\n:::",
  callout: "::: warning\n" + raw + "\n:::",
  link: "[open](javascript:window.__folio_probe=1)",
  fenced: fenceMarker + "html\n" + raw + "\n" + fenceMarker,
  fencedCallout: fenceMarker + "md\n::: warning literal :::\n" + fenceMarker,
  trusted: '::: html\n<div class="claude-visual"><svg viewBox="0 0 10 10"></svg></div>\n:::',
};
function report(label, html) {
  const f = {
    eventAttribute: html.includes('onerror="window.__folio_probe=1"'),
    jsHref: html.includes('href="javascript:'),
    literalImgTag: html.includes("<img"),
    escapedTag: html.includes("&lt;"),
    htmlClass: html.includes('class="claude-visual"'),
    callout: html.includes("md-custom-block--warning"),
  };
  console.log("FOL003_PROBE " + JSON.stringify({label,...f}));
  return f;
}
test("FOL-003 Markdown raw/directive/callout/URL/fence observation", () => {
  const plain=report("raw",renderFolioMarkdown(vectors.raw));
  const directive=report("directive",renderFolioMarkdown(vectors.directive));
  const callout=report("callout",renderFolioMarkdown(vectors.callout));
  const link=report("link",renderFolioMarkdown(vectors.link));
  const fenced=report("fenced",renderFolioMarkdown(vectors.fenced));
  const fencedCallout=report("fenced-callout",renderFolioMarkdown(vectors.fencedCallout));
  const trusted=report("trusted",renderFolioMarkdown(vectors.trusted));
  assert.equal(plain.eventAttribute,true);
  assert.equal(directive.eventAttribute,true);
  assert.equal(callout.eventAttribute,true);
  assert.equal(link.jsHref,true);
  assert.equal(fenced.literalImgTag,false);
  assert.equal(fenced.escapedTag,true);
  assert.equal(fencedCallout.callout,false);
  assert.equal(trusted.htmlClass,true);
});
test("FOL-003 React SSR retains unsafe attribute in FolioMarkdown HTML", () => {
  const html=renderToStaticMarkup(createElement(FolioMarkdown,{source:vectors.raw}));
  assert.equal(report("react-ssr",html).eventAttribute,true);
});
test("FOL-003 static writer retains unsafe attribute in produced HTML", () => {
  const outDir=mkdtempSync(resolve(tmpdir(),"folio003-"));
  try {
    writeFileSync(resolve(outDir,"index.html"),'<!doctype html><html><head><title>Probe</title></head><body><div id="root"></div></body></html>');
    const doc={id:"unsafe",path:"/docs/unsafe",sourcePath:"docs/unsafe.md",type:"article",title:"Test",description:"test",group:"Docs",body:vectors.raw,headings:[],data:{}};
    const context={outDir,base:"/folio/",config:{title:"Folio",description:"Docs",siteUrl:"https://example.com"},docs:[doc],roots:["docs"]};
    assert.equal(writeFolioStaticSite(context).routes,2);
    const html=readFileSync(resolve(outDir,"docs/unsafe/index.html"),"utf8");
    assert.equal(report("static-writer",html).eventAttribute,true);
  } finally {rmSync(outDir,{recursive:true,force:true});}
});