import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  folioNavHref,
  isFolioNavItemActive,
  groupEntries,
  resolveFolioNavigation,
} from "../dist/index.js";

// The navigation resolver is the contract between configuration and the
// header. These tests pin the two properties the redesign must not break:
// plain `{label, href}` entries stay plain links, and structured entries only
// add behavior on top of a shape that already had one.

test("a plain {label, href} entry resolves to a plain link", () => {
  const items = resolveFolioNavigation([{ label: "文章", href: "/blogs" }]);
  assert.deepEqual(items, [{ kind: "link", label: "文章", href: "/blogs" }]);
});

test("navigation is data-driven, not route-specific", () => {
  // The prohibition on hardcoded /about or /blogs logic means any route must
  // be able to become a menu; a route that is special-cased would pass this
  // for /blogs but fail for an arbitrary path.
  const items = resolveFolioNavigation([
    {
      label: "Whatever",
      href: "/some/deep/path",
      children: [{ label: "Child", href: "/some/deep/path/child" }],
    },
  ]);
  assert.equal(items[0].kind, "menu");
  assert.equal(items[0].entries[1].href, "/some/deep/path/child");
});

test("an entry without children stays a link, so old configs are unchanged", () => {
  const items = resolveFolioNavigation([
    { label: "A", href: "/a" },
    { label: "B", href: "/b", children: [] },
  ]);
  assert.deepEqual(
    items.map((item) => item.kind),
    ["link", "link"],
  );
});

test("a menu generates an overview entry for the item's own href", () => {
  const [item] = resolveFolioNavigation([
    {
      label: "开始",
      href: "/docs/introduction",
      children: [{ label: "内容协议", href: "/docs/content-contract" }],
      panel: { overviewLabel: "全部手册" },
    },
  ]);
  assert.deepEqual(item.entries[0], {
    label: "全部手册",
    href: "/docs/introduction",
  });
});

test("the overview entry is not duplicated when a child already targets it", () => {
  const [item] = resolveFolioNavigation([
    {
      label: "开始",
      href: "/docs/introduction",
      children: [
        { label: "介绍", href: "/docs/introduction" },
        { label: "内容协议", href: "/docs/content-contract" },
      ],
    },
  ]);
  assert.equal(item.entries.length, 2);
  assert.deepEqual(
    item.entries.map((entry) => entry.label),
    ["介绍", "内容协议"],
  );
});

test("the overview label falls back to the item label", () => {
  const [item] = resolveFolioNavigation([
    { label: "部署", href: "/deploy", children: [{ label: "Pages", href: "/deploy/pages" }] },
  ]);
  assert.equal(item.entries[0].label, "全部部署");
});

test("a panel title falls back to the item label but keeps an explicit one", () => {
  const [withTitle, withoutTitle] = resolveFolioNavigation([
    {
      label: "API",
      href: "/api",
      children: [{ label: "Config", href: "/api/config" }],
      panel: { title: "API 与配置参考", eyebrow: "REFERENCE" },
    },
    {
      label: "指南",
      href: "/guide",
      children: [{ label: "Setup", href: "/guide/setup" }],
    },
  ]);
  assert.equal(withTitle.panel.title, "API 与配置参考");
  assert.equal(withTitle.panel.eyebrow, "REFERENCE");
  assert.equal(withoutTitle.panel.title, "指南");
  assert.equal(withoutTitle.panel.eyebrow, undefined);
});

test("malformed children are dropped instead of rendering empty rows", () => {
  const [item] = resolveFolioNavigation([
    {
      label: "混合",
      href: "/mixed",
      children: [
        { label: "好的", href: "/mixed/good" },
        { label: "", href: "/mixed/blank-label" },
        { label: "缺链接", href: "" },
        { label: "  ", href: "/mixed/spaces" },
      ],
    },
  ]);
  assert.deepEqual(
    item.entries.map((entry) => entry.label),
    ["全部混合", "好的"],
  );
});

test("whitespace is trimmed and trailing slashes are normalized", () => {
  const [item] = resolveFolioNavigation([
    {
      label: "  文档  ",
      href: "  /docs/  ",
      children: [{ label: " 一 ", href: "/docs/one/", description: " 说明 " }],
    },
  ]);
  assert.equal(item.label, "文档");
  assert.equal(item.href, "/docs");
  assert.equal(item.entries[1].href, "/docs/one");
  assert.equal(item.entries[1].description, "说明");
});

test("the root route keeps its slash and never prefix-matches everything", () => {
  assert.equal(folioNavHref("/"), "/");
  assert.equal(folioNavHref("/docs/"), "/docs");

  const [home, docs] = resolveFolioNavigation([
    { label: "首页", href: "/" },
    { label: "文档", href: "/docs" },
  ]);
  assert.equal(isFolioNavItemActive(home, "/"), true);
  assert.equal(isFolioNavItemActive(home, "/docs"), false);
  assert.equal(isFolioNavItemActive(docs, "/docs/introduction"), true);
  assert.equal(isFolioNavItemActive(docs, "/docs-archive"), false);
});

test("a menu is active when any of its entries matches", () => {
  const [item] = resolveFolioNavigation([
    {
      label: "开始",
      href: "/docs/introduction",
      children: [
        { label: "介绍", href: "/docs/introduction" },
        { label: "内容协议", href: "/docs/content-contract" },
      ],
    },
  ]);
  assert.equal(isFolioNavItemActive(item, "/docs/content-contract"), true);
  assert.equal(isFolioNavItemActive(item, "/blogs"), false);
});

test("a missing or non-array navigation config yields no items", () => {
  assert.deepEqual(resolveFolioNavigation(undefined), []);
  assert.deepEqual(resolveFolioNavigation([]), []);
});

test("the export is exercised through the published entry point", async () => {
  const module = await import("../dist/index.js");
  assert.equal(typeof module.resolveFolioNavigation, "function");
  assert.equal(typeof module.isFolioNavItemActive, "function");
  assert.equal(typeof module.folioNavHref, "function");
});

test("the built types expose the new navigation fields", () => {
  // A type-level guard would be ideal, but the package ships declarations only;
  // asserting on the generated .d.ts keeps the public shape from silently
  // regressing to the two-field version.
  const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const declaration = readFileSync(join(packageRoot, "dist", "index.d.ts"), "utf8");
  for (const token of [
    "FolioNavigationItem",
    "FolioNavigationChild",
    "FolioNavigationPanel",
    "FolioNavigationIconName",
    "children",
    "panel",
  ]) {
    assert.ok(declaration.includes(token), `dist/index.d.ts is missing ${token}`);
  }
});

test("a menu without groups stays one flat run, as before", () => {
  const [item] = resolveFolioNavigation([
    {
      label: "开始",
      href: "/docs/introduction",
      children: [
        { label: "内容协议", href: "/docs/content-contract" },
        { label: "运行时", href: "/docs/runtime-composition" },
      ],
    },
  ]);
  assert.equal(item.groups.length, 1);
  assert.equal(item.groups[0].label, undefined);
  assert.equal(item.groups[0].entries.length, 3, "overview entry is included");
});

test("grouped entries split into reading tasks in first-seen order", () => {
  const [item] = resolveFolioNavigation([
    {
      label: "文档",
      href: "/docs/",
      children: [
        { label: "快速开始", href: "/a", group: "快速开始" },
        { label: "编写内容", href: "/b", group: "编写与配置" },
        { label: "内容模型", href: "/c", group: "编写与配置" },
        { label: "构建集成", href: "/d", group: "参考资料" },
      ],
    },
  ]);
  assert.deepEqual(
    item.groups.map((group) => group.label),
    [undefined, "快速开始", "编写与配置", "参考资料"],
  );
  assert.deepEqual(
    item.groups.map((group) => group.entries.length),
    [1, 1, 2, 1],
    "the ungrouped overview entry is hoisted ahead of the labelled runs",
  );
});

test("entries stay flat on `entries` so group-agnostic consumers keep working", () => {
  const [item] = resolveFolioNavigation([
    {
      label: "文档",
      href: "/docs/",
      children: [
        { label: "A", href: "/a", group: "One" },
        { label: "B", href: "/b", group: "Two" },
      ],
    },
  ]);
  assert.deepEqual(
    item.entries.map((entry) => entry.label),
    ["全部文档", "A", "B"],
  );
  assert.equal(
    item.groups.reduce((total, group) => total + group.entries.length, 0),
    item.entries.length,
    "groups and entries never disagree about the panel contents",
  );
});

test("group headings are trimmed and blank groups are ignored", () => {
  const [item] = resolveFolioNavigation([
    {
      label: "文档",
      href: "/docs/",
      children: [
        { label: "A", href: "/a", group: "  参考资料  " },
        { label: "B", href: "/b", group: "   " },
      ],
    },
  ]);
  const labels = item.groups.map((group) => group.label);
  assert.ok(labels.includes("参考资料"));
  assert.ok(
    item.groups.some((group) => group.label === undefined && group.entries.some((e) => e.label === "B")),
    "a whitespace-only group is treated as ungrouped",
  );
});

test("groupEntries is exported and tolerates an empty list", () => {
  assert.deepEqual(groupEntries([]), []);
});

test("a plain entry is unaffected by the grouping feature", () => {
  const [item] = resolveFolioNavigation([{ label: "展厅", href: "/showcase" }]);
  assert.equal(item.kind, "link");
  assert.equal(item.groups, undefined, "links carry no panel groups");
});
