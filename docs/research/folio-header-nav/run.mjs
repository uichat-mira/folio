// Header / documentation-navigation verification.
//
// Real-browser checks against a running dev server. Nothing here reads source
// text or trusts CI: every assertion comes from a live DOM, a computed style, or
// a painted pixel.
//
// Usage:
//   npx playwright install chromium
//   npm run dev -w apps/site                       # or: GITHUB_REPOSITORY=uichat-mira/folio npm run dev -w apps/site
//   FOLIO_BASE=http://localhost:5173 node docs/research/folio-header-nav/run.mjs
//
// Set FOLIO_BASE to the served base (`http://localhost:5174/folio/` when
// GITHUB_REPOSITORY is set) to verify the deployed base path. Set
// PLAYWRIGHT_CHROMIUM_EXECUTABLE to use an already-downloaded Chromium instead
// of the one matching this Playwright version. Screenshots and results.json are
// written next to this file.
//
// The official site intentionally configures no dropdown, so this script cannot
// exercise panel interaction any more. Structured dropdowns are still exported
// and covered by packages/folio/test/header.test.mjs (markup) and
// packages/folio/test/navigation.test.mjs (resolution, grouping, active rules).
// See README.md for why browser-level panel checks no longer apply here.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// `playwright` is a dev-only dependency for this script and is not part of the
// package's dependency graph, so resolve it from whatever install is available
// (workspace, global, or PLAYWRIGHT_MODULE_DIR).
const playwrightSpecifier = process.env.PLAYWRIGHT_MODULE_DIR
  ? `file://${process.env.PLAYWRIGHT_MODULE_DIR}/index.mjs`
  : "playwright";
const { chromium } = await import(playwrightSpecifier);

const OUT = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.FOLIO_BASE || "http://localhost:5173";
const shots = join(OUT, "shots");
mkdirSync(shots, { recursive: true });

const results = [];
const record = (name, data) => {
  results.push({ check: name, ...data });
  console.log(`\n=== ${name}`);
  for (const [key, value] of Object.entries(data)) {
    console.log(`  ${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`);
  }
};

// Sample painted pixels so the surface checks do not need a human eye.
async function sample(page, points) {
  const base64 = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ base64, points }) => {
      const image = new Image();
      image.src = "data:image/png;base64," + base64;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      return points.map(({ x, y, label }) => {
        const data = context.getImageData(Math.round(x), Math.round(y), 1, 1).data;
        return { label, rgb: [data[0], data[1], data[2]] };
      });
    },
    { base64, points },
  );
}

// Read the docs chrome of the current page. The sidebar heading is the real
// proof that a top-level link lands in its own document view.
const docsChrome = (page) =>
  page.evaluate(() => ({
    path: location.pathname,
    heading: document.querySelector("h1")?.textContent.trim().slice(0, 36) ?? null,
    sidebarCollection:
      document.querySelector(".folio-docnav__collection")?.textContent.trim() ?? null,
    sidebarSections: [...document.querySelectorAll(".folio-docnav section > h2")].map((element) =>
      element.textContent.trim(),
    ),
    sidebarLinks: document.querySelectorAll(".folio-docnav a").length,
    tocLinks: document.querySelectorAll(".folio-toc a").length,
    activeTopLevel: [...document.querySelectorAll(".folio-desktop-nav .active")].map((element) =>
      element.textContent.trim(),
    ),
  }));

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {},
);

// ---------------------------------------------------------------- desktop ---
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE, { waitUntil: "networkidle" });

  record(
    "desktop 1440 layout",
    await page.evaluate(() => {
      const rect = (selector) =>
        document.querySelector(selector)?.getBoundingClientRect().toJSON() ?? null;
      const wrap = document.querySelector(".folio-header__wrap");
      return {
        headerHeight: rect(".folio-header").height,
        wrapPadding: getComputedStyle(wrap).padding,
        brandLeftGap: Math.round(rect(".folio-brand").left - wrap.getBoundingClientRect().left),
        navClusterRightGap: Math.round(
          wrap.getBoundingClientRect().right - rect(".folio-header__nav").right,
        ),
        gapNavToActions: Math.round(
          rect(".folio-header-actions").left - rect(".folio-desktop-nav").right,
        ),
        topLevelItems: document.querySelectorAll(".folio-desktop-nav__list > li").length,
        navIsRightOfBrand: rect(".folio-desktop-nav").left > rect(".folio-brand").right,
        horizontalOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }),
  );

  record(
    "top-level navigation is five plain links",
    await page.evaluate(() => {
      const items = [...document.querySelectorAll(".folio-desktop-nav__list > li")];
      return {
        entries: items.map((item) => item.querySelector("a")?.textContent.trim()),
        hrefs: items.map((item) => item.querySelector("a")?.getAttribute("href")),
        menuTriggers: document.querySelectorAll(".folio-nav-menu__trigger").length,
        dropdownPanels: document.querySelectorAll(".folio-nav-menu__panel").length,
        // A plain link must not carry the disclosure affordance.
        chevrons: items.filter((item) => item.querySelector("a svg")).length,
        accordions: document.querySelectorAll(".folio-mobile-group__trigger").length,
      };
    }),
  );
  await page.screenshot({ path: join(shots, "01-desktop-header.png") });

  // 指南 and 参考 must each open their own document view: sidebar + TOC.
  const sections = [];
  for (const [label, expected] of [
    ["指南", "指南"],
    ["参考", "参考"],
  ]) {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page
      .locator(".folio-desktop-nav__list > li > a")
      .filter({ hasText: new RegExp(`^${label}$`) })
      .click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
    sections.push({ clicked: label, expected, ...(await docsChrome(page)) });
  }
  record("指南 and 参考 open their own document views", sections);
  await page.screenshot({ path: join(shots, "02-guide-docs-view.png") });

  // Deep links inside each section, including the pages that do not sit under
  // the section's own `href` directory.
  const deep = [];
  for (const path of [
    "/docs/introduction",
    "/docs/content-contract",
    "/docs/runtime-composition",
    "/api/guide/content-model",
    "/api/guide/architecture",
    "/api/guide/what-is-folio",
    "/api/reference/frontmatter",
    "/api/deployment/github-pages",
    "/docs/content-maintenance",
  ]) {
    const response = await page.goto(BASE + path, { waitUntil: "networkidle" });
    deep.push({ path, status: response?.status(), ...(await docsChrome(page)) });
  }
  record("deep links keep the right sidebar and a single active entry", {
    pages: deep.length,
    // Every page must show exactly one active top-level entry; two would mean
    // the sections over-claimed one another's routes.
    pagesWithWrongActiveCount: deep.filter((entry) => entry.activeTopLevel.length !== 1).length,
    withoutSidebar: deep.filter((entry) => !entry.sidebarCollection).length,
    withoutToc: deep.filter((entry) => entry.tocLinks === 0).length,
    sidebarByCollection: deep.reduce((accumulator, entry) => {
      const key = entry.sidebarCollection ?? "(none)";
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {}),
  });

  // Client-side routing must not remount the header, and the sidebar must
  // follow the route change.
  await page.goto(BASE + "/docs/introduction", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    window.__header = document.querySelector(".folio-header");
  });
  await page.locator('.folio-docnav a[href$="/api/guide/content-model"]').first().click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
  record(
    "client routing keeps the header and swaps the sidebar",
    await page.evaluate(() => ({
      path: location.pathname,
      sameHeaderNode: window.__header === document.querySelector(".folio-header"),
      sidebarCollection: document.querySelector(".folio-docnav__collection")?.textContent.trim(),
      activeTopLevel: [...document.querySelectorAll(".folio-desktop-nav .active")].map((element) =>
        element.textContent.trim(),
      ),
    })),
  );

  // Switching sections through the header must swap the whole sidebar.
  await page
    .locator(".folio-desktop-nav__list > li > a")
    .filter({ hasText: /^参考$/ })
    .click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
  record(
    "header switch replaces the sidebar contents",
    await page.evaluate(() => ({
      path: location.pathname,
      sidebarCollection: document.querySelector(".folio-docnav__collection")?.textContent.trim(),
      sidebarLinks: [...document.querySelectorAll(".folio-docnav a")].map((element) =>
        element.textContent.trim().slice(0, 18),
      ),
      activeTopLevel: [...document.querySelectorAll(".folio-desktop-nav .active")].map((element) =>
        element.textContent.trim(),
      ),
    })),
  );

  await page.evaluate(() => scrollTo(0, 600));
  await page.waitForTimeout(250);
  record(
    "sticky header and docs chrome unaffected",
    await page.evaluate(() => ({
      headerTop: document.querySelector(".folio-header").getBoundingClientRect().top,
      tocLinks: document.querySelectorAll(".folio-toc a").length,
      docNavLinks: document.querySelectorAll(".folio-docnav a").length,
    })),
  );

  await page.evaluate(() => scrollTo(0, 0));
  await page.locator(".folio-theme-toggle").click();
  await page.waitForTimeout(400);
  record("dark mode", {
    theme: await page.evaluate(() =>
      document.documentElement.getAttribute("data-folio-theme"),
    ),
    headerPixels: await sample(page, [{ x: 700, y: 32, label: "header" }]),
  });

  await page.close();
}

// ------------------------------------------------------- non-docs surfaces ---
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pages = [];
  for (const path of ["/", "/blogs", "/projects", "/showcase"]) {
    const response = await page.goto(BASE + path, { waitUntil: "networkidle" });
    pages.push({
      path,
      status: response?.status(),
      heading: await page.evaluate(() =>
        document.querySelector("h1")?.textContent.trim().slice(0, 30),
      ),
      hasDocsSidebar: await page.evaluate(() => Boolean(document.querySelector(".folio-docnav"))),
      activeTopLevel: await page.evaluate(() =>
        [...document.querySelectorAll(".folio-desktop-nav .active")].map((element) =>
          element.textContent.trim(),
        ),
      ),
      horizontalOverflow: await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    });
  }
  record("home, 展厅, 文章 and 项目 are untouched", pages);
  await page.screenshot({ path: join(shots, "03-home.png") });
  await page.close();
}

// ------------------------------------------------------------ search (JS) ---
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.locator(".folio-search-trigger").click();
  await page.waitForTimeout(400);
  await page.keyboard.type("导航");
  await page.waitForTimeout(700);
  record(
    "search still finds documents across both sections",
    await page.evaluate(() => {
      const options = [...document.querySelectorAll("[role=option]")];
      return {
        results: options.length,
        sample: options.slice(0, 3).map((option) => option.textContent.trim().slice(0, 44)),
      };
    }),
  );
  await page.screenshot({ path: join(shots, "04-search.png") });
  await page.close();
}

// ------------------------------------------------------ horizontal sweeps ---
{
  const sweeps = [];
  for (const width of [1440, 1280, 1024, 960, 900, 820, 781, 768, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(BASE, { waitUntil: "networkidle" });
    sweeps.push(
      await page.evaluate(() => {
        const desktop = document.querySelector(".folio-desktop-nav");
        const desktopVisible = desktop ? getComputedStyle(desktop).display !== "none" : false;
        const items = [...document.querySelectorAll(".folio-desktop-nav__list > li > a")];
        return {
          width: innerWidth,
          desktopVisible,
          items: items.length,
          truncated: items.filter(
            (element) => element.scrollWidth > element.clientWidth + 1,
          ).length,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      }),
    );
    await page.close();
  }
  record("no width overflows and no item truncates", {
    widths: sweeps.length,
    overflowing: sweeps.filter((entry) => entry.overflow > 0).length,
    truncated: sweeps.filter((entry) => entry.truncated > 0).length,
    rows: sweeps.map((entry) => ({
      width: entry.width,
      desktop: entry.desktopVisible,
      overflow: entry.overflow,
    })),
  });
}

// ------------------------------------------------------------------ tablet ---
{
  const page = await browser.newPage({ viewport: { width: 820, height: 1000 } });
  await page.goto(BASE, { waitUntil: "networkidle" });
  record(
    "tablet 820",
    await page.evaluate(() => ({
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      desktopNavVisible:
        getComputedStyle(document.querySelector(".folio-desktop-nav")).display !== "none",
      searchLabelVisible:
        getComputedStyle(document.querySelector(".folio-search-trigger span")).display !== "none",
      truncatedItems: [...document.querySelectorAll(".folio-desktop-nav__list > li > a")].filter(
        (element) => element.scrollWidth > element.clientWidth + 1,
      ).length,
    })),
  );
  await page.screenshot({ path: join(shots, "05-tablet-820.png") });
  await page.close();
}

// ------------------------------------------------------------------ phone ---
for (const width of [390, 320]) {
  const page = await browser.newPage({
    viewport: { width, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  await page.goto(BASE, { waitUntil: "networkidle" });

  const closed = await page.evaluate(() => {
    const brand = document.querySelector(".folio-brand").getBoundingClientRect();
    const actions = document.querySelector(".folio-header-actions").getBoundingClientRect();
    return {
      headerHeight: document.querySelector(".folio-header").getBoundingClientRect().height,
      desktopNavHidden:
        getComputedStyle(document.querySelector(".folio-desktop-nav")).display === "none",
      menuButtonVisible:
        getComputedStyle(document.querySelector(".folio-mobile-menu-button")).display !== "none",
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      brandOverlapsActions: brand.right > actions.left,
    };
  });
  await page.screenshot({ path: join(shots, `06-phone-${width}-closed.png`) });

  await page.locator(".folio-mobile-menu-button").tap();
  await page.waitForTimeout(320);
  const opened = await page.evaluate(() => {
    const panel = document.querySelector(".folio-mobile-panel");
    return {
      visibility: getComputedStyle(panel).visibility,
      top: Math.round(panel.getBoundingClientRect().top),
      width: Math.round(panel.getBoundingClientRect().width),
      links: [...panel.querySelectorAll("nav a")].map((element) => element.textContent.trim()),
      accordionTriggers: document.querySelectorAll(".folio-mobile-group__trigger").length,
      desktopPanelInsideMobile: document.querySelectorAll(
        ".folio-mobile-panel .folio-nav-menu__panel",
      ).length,
    };
  });
  await page.screenshot({ path: join(shots, `07-phone-${width}-panel.png`) });

  // A phone tap must reach the document view, not just close the panel.
  await page
    .locator(".folio-mobile-panel nav a")
    .filter({ hasText: /^指南$/ })
    .first()
    .tap();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  const navigated = await page.evaluate(() => ({
    path: location.pathname,
    sidebarCollection: document.querySelector(".folio-docnav__collection")?.textContent.trim(),
    tocLinks: document.querySelectorAll(".folio-toc a").length,
    panelClosed:
      getComputedStyle(document.querySelector(".folio-mobile-panel")).visibility === "hidden",
  }));

  record(`phone ${width}`, { closed, opened, navigated });
  await page.close();
}

// --------------------------------------------------------- reduced motion ---
{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  record(
    "prefers-reduced-motion disables header motion",
    await page.evaluate(() => ({
      navLink: getComputedStyle(document.querySelector(".folio-desktop-nav__list a"))
        .transitionDuration,
      mobilePanel: getComputedStyle(document.querySelector(".folio-mobile-panel")).transitionDuration,
      themeToggle: getComputedStyle(document.querySelector(".folio-theme-toggle"))
        .transitionDuration,
    })),
  );
  await context.close();
}

// --------------------------------------------------------------- keyboard ---
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE, { waitUntil: "networkidle" });
  // Tab through the header until focus lands on a top-level nav link, then
  // activate it: keyboard users must be able to enter the docs view too.
  let reached = null;
  for (let step = 0; step < 12; step += 1) {
    await page.keyboard.press("Tab");
    const state = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        tag: active?.tagName,
        text: active?.textContent?.trim().slice(0, 12),
        href: active?.getAttribute?.("href") ?? null,
        insideNav: Boolean(active?.closest(".folio-desktop-nav__list")),
      };
    });
    if (state.insideNav) {
      reached = state;
      break;
    }
  }
  await page.keyboard.press("Enter");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  record("keyboard can reach and enter a section", {
    focused: reached,
    landedPath: await page.evaluate(() => location.pathname),
    sidebarCollection: await page.evaluate(
      () => document.querySelector(".folio-docnav__collection")?.textContent.trim() ?? null,
    ),
  });
  await page.screenshot({ path: join(shots, "08-keyboard.png") });
  await page.close();
}

await browser.close();
writeFileSync(join(OUT, "results.json"), JSON.stringify(results, null, 2) + "\n");
console.log(`\n${results.length} checks recorded in ${join(OUT, "results.json")}`);
