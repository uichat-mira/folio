import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveGithubPagesBase } from "@uichat-mira/folio";

const site = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(site, "dist");
const content = resolve(site, "content");
const base = process.env.FOLIO_SITE_BASE ?? resolveGithubPagesBase(process.env.GITHUB_REPOSITORY);
const baseSegments = base.split("/").filter(Boolean);
const basePath = baseSegments.length ? "/" + baseSegments.join("/") + "/" : "/";
const routeFile = (route) => route === "/" ? join(dist, "index.html") : join(dist, route.slice(1), "index.html");

function page(route) {
  const file = routeFile(route);
  assert.ok(existsSync(file), "Missing static route " + route);
  return readFileSync(file, "utf8");
}
const home = page("/");
const about = page("/about");
const guide = page("/guide/introduction");
const reference = page("/reference/overview");
const component = page("/reference/components");
const blog = page("/blogs");
const article = page("/blogs/why-folio");
const notFound = readFileSync(join(dist, "404.html"), "utf8");
const sitemap = readFileSync(join(dist, "sitemap.xml"), "utf8");

assert.match(about, /folio-prerender--page/);
assert.match(about, /<article class="folio-markdown">/);
assert.match(about, /Git-native/);
assert.match(home, /\/about/);
for(const [label, html] of [["Guide",guide],["Reference",reference],["Components",component]]) {
  assert.match(html, /folio-docs-shell/, label + " lost the reading shell");
  assert.match(html, /folio-tree-nav/, label + " lost the sidebar");
  assert.match(html, /folio-page-nav/, label + " lost the pager");
}
assert.match(blog, /folio-collection-page/);
assert.match(article, /folio-article-main/);
assert.match(notFound, /noindex,nofollow/);
assert.match(sitemap, /\/about\/?<\/loc>/);
assert.doesNotMatch(sitemap, /\/(?:showcase|projects)(?:\/|<)/);
for(const removed of ["showcase","projects"]) {
  assert.ok(!existsSync(join(dist,removed)), "Retired route still exists: " + removed);
  assert.doesNotMatch(home, new RegExp("/" + removed + "(?:/|[\"<])"));
}

const htmlFiles = [];
function scanHtml(dir) {
  for(const item of readdirSync(dir,{withFileTypes:true})) {
    const path = join(dir,item.name);
    if(item.isDirectory()) scanHtml(path);
    else if(item.name.endsWith(".html")) htmlFiles.push(path);
  }
}
scanHtml(dist);
const broken = [];
for(const file of htmlFiles) {
  const html = readFileSync(file,"utf8");
  for(const [,href] of html.matchAll(/\bhref="([^"]+)"/g)) {
    if(!href.startsWith("/") || href.startsWith("//")) continue;
    if(!href.startsWith(basePath)) {
      broken.push(relative(dist,file)+" -> wrong base "+href);
      continue;
    }
    const inner = href.slice(basePath.length).split(/[?#]/,1)[0];
    if(!inner || inner.includes("..")) continue;
    const path = join(dist,decodeURIComponent(inner));
    if(!existsSync(path) && !existsSync(join(path,"index.html")) && !existsSync(path+".html")) {
      broken.push(relative(dist,file)+" -> "+href);
    }
  }
}
assert.deepEqual(broken,[], "Internal links must target built routes/assets");

const retiredLinks=[];
function scanMarkdown(dir) {
  for(const item of readdirSync(dir,{withFileTypes:true})) {
    const path = join(dir,item.name);
    if(item.isDirectory())scanMarkdown(path);
    else if(item.name.endsWith(".md")) {
      const source=readFileSync(path,"utf8");
      if(/\]\(\/(?:showcase|projects)(?:\/|\))/.test(source))
        retiredLinks.push(relative(content,path));
    }
  }
}
scanMarkdown(content);
assert.deepEqual(retiredLinks,[],"Markdown still links to retired routes");
console.log("[folio-site] "+htmlFiles.length+" HTML routes; About, docs, blog, base, sitemap, retired paths and links verified for "+basePath);
