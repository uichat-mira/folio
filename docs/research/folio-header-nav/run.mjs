// Header redesign verification (FOL header first-pass).
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

const visiblePanel = () =>
  [...document.querySelectorAll(".folio-nav-menu__panel")].find(
    (element) => getComputedStyle(element).visibility === "visible",
  );

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
    "top-level navigation expresses content categories",
    await page.evaluate(() => ({
      entries: [...document.querySelectorAll(".folio-desktop-nav__list > li")].map((item) =>
        item.querySelector(".folio-nav-menu__trigger, a")?.textContent.trim(),
      ),
      menuCount: document.querySelectorAll(".folio-nav-menu").length,
      plainLinkCount: document.querySelectorAll(
        ".folio-desktop-nav__list > li > a:not(.folio-nav-menu__trigger)",
      ).length,
    })),
  );

  await page.locator(".folio-nav-menu__trigger").first().hover();
  await page.waitForTimeout(320);
  record(
    "dropdown expresses reading tasks",
    await page.evaluate(() => {
      const panel = [...document.querySelectorAll(".folio-nav-menu__panel")].find(
        (element) => getComputedStyle(element).visibility === "visible",
      );
      const box = panel.getBoundingClientRect();
      return {
        title: panel.querySelector(".folio-nav-menu__head strong")?.textContent,
        groups: [...panel.querySelectorAll(".folio-nav-menu__group-label")].map(
          (element) => element.textContent,
        ),
        entriesPerGroup: [...panel.querySelectorAll(".folio-nav-menu__group")].map((group) => ({
          label: group.querySelector(".folio-nav-menu__group-label")?.textContent ?? "(overview)",
          count: group.querySelectorAll(".folio-nav-menu__entry").length,
        })),
        fitsViewport: box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
        size: [Math.round(box.width), Math.round(box.height)],
      };
    }),
  );
  record(
    "dropdown opens on hover",
    await page.evaluate(() => {
      const panel = document.querySelector(".folio-nav-menu__panel");
      const box = panel.getBoundingClientRect();
      return {
        visibility: getComputedStyle(panel).visibility,
        opacity: getComputedStyle(panel).opacity,
        transition: getComputedStyle(panel).transitionDuration,
        entries: document.querySelectorAll(".folio-nav-menu__entries a").length,
        ariaExpanded: document
          .querySelector(".folio-nav-menu__trigger")
          .getAttribute("aria-expanded"),
        fullyInViewport:
          box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
      };
    }),
  );
  await page.screenshot({ path: join(shots, "01-desktop-dropdown.png") });

  // Cross the 14px gap straight down the trigger's own column. A diagonal path
  // legitimately switches to the neighbouring item, so the assertion is on the
  // panel of the item under the pointer, not on DOM order.
  const triggerBox = await page.locator(".folio-nav-menu__trigger").first().boundingBox();
  const panelBox = await page.locator(".folio-nav-menu__panel").first().boundingBox();
  await page.mouse.move(triggerBox.x + triggerBox.width / 2, panelBox.y + 40, { steps: 20 });
  await page.waitForTimeout(400);
  record(
    "panel survives the pointer gap",
    await page.evaluate((fn) => {
      const open = eval(`(${fn})`)();
      return {
        anyVisible: Boolean(open),
        openPanels: document.querySelectorAll(".folio-nav-menu.is-open").length,
      };
    }, visiblePanel.toString()),
  );

  await page.keyboard.press("Escape");
  await page.waitForTimeout(320);
  record("escape closes", {
    visible: await page.evaluate(
      () => getComputedStyle(document.querySelector(".folio-nav-menu__panel")).visibility,
    ),
  });

  await page.locator(".folio-nav-menu__trigger").first().click();
  await page.waitForTimeout(300);
  record("click opens", {
    expanded: await page
      .locator(".folio-nav-menu__trigger")
      .first()
      .getAttribute("aria-expanded"),
  });

  await page.mouse.click(700, 500);
  await page.waitForTimeout(300);
  record("outside click closes", {
    visible: await page.evaluate(
      () => getComputedStyle(document.querySelector(".folio-nav-menu__panel")).visibility,
    ),
  });

  // A real navigation through a panel entry.
  await page.locator(".folio-nav-menu__trigger").first().hover();
  await page.waitForTimeout(280);
  // Click a grouped entry, not the overview row: the overview points at the
  // collection index, which has no docs chrome to check afterwards.
  const startLink = page
    .locator(".folio-nav-menu__group")
    .filter({ has: page.locator(".folio-nav-menu__group-label") })
    .first()
    .locator("a")
    .first();
  const target = await startLink.getAttribute("href");
  await startLink.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  record("panel entry navigates and closes the panel", {
    target,
    landed: new URL(page.url()).pathname,
    heading: (await page.locator("h1").first().textContent())?.trim().slice(0, 40),
    panelVisible: await page.evaluate(
      () => getComputedStyle(document.querySelector(".folio-nav-menu__panel")).visibility,
    ),
    activeItem: await page.evaluate(
      () => document.querySelector(".folio-desktop-nav .active")?.textContent.trim() ?? null,
    ),
  });

  // Client-side routing must not remount the header.
  await page.evaluate(() => {
    window.__header = document.querySelector(".folio-header");
  });
  await page.locator(".folio-docnav a").nth(2).click();
  await page.waitForTimeout(600);
  record(
    "client routing keeps the header instance",
    await page.evaluate(() => ({
      path: location.pathname,
      sameNode: window.__header === document.querySelector(".folio-header"),
      activeItem: document.querySelector(".folio-desktop-nav .active")?.textContent.trim() ?? null,
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

// ------------------------------------------------------ horizontal sweeps ---
{
  for (const width of [1440, 1024, 900, 820, 781]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(BASE, { waitUntil: "networkidle" });
    const navVisible = await page.evaluate(() => {
      const element = document.querySelector(".folio-desktop-nav");
      return element ? getComputedStyle(element).display !== "none" : false;
    });
    const count = navVisible ? await page.locator(".folio-nav-menu__trigger").count() : 0;
    const panels = [];
    for (let index = 0; index < count; index += 1) {
      await page.locator(".folio-nav-menu__trigger").nth(index).hover();
      await page.waitForTimeout(260);
      panels.push(
        await page.evaluate(() => {
          const open = [...document.querySelectorAll(".folio-nav-menu__panel")].find(
            (element) => getComputedStyle(element).visibility === "visible",
          );
          if (!open) return { missing: true };
          const box = open.getBoundingClientRect();
          return {
            label: open
              .closest("li")
              .querySelector(".folio-nav-menu__trigger")
              .textContent.trim()
              .slice(0, 8),
            fullyInViewport: box.left >= 0 && box.right <= innerWidth,
          };
        }),
      );
      await page.mouse.move(2, 500);
      await page.waitForTimeout(160);
    }
    record(`all panels stay on screen at ${width}px`, {
      panels: panels.length,
      offscreen: panels.filter((panel) => panel.missing || !panel.fullyInViewport).length,
    });
    await page.close();
  }
}

// ------------------------------------------------------------------ tablet ---
{
  const page = await browser.newPage({ viewport: { width: 820, height: 1000 } });
  await page.goto(BASE, { waitUntil: "networkidle" });
  record(
    "tablet 820",
    await page.evaluate(() => ({
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      desktopNavVisible: getComputedStyle(document.querySelector(".folio-desktop-nav")).display !== "none",
      searchLabelVisible:
        getComputedStyle(document.querySelector(".folio-search-trigger span")).display !== "none",
      truncatedItems: [...document.querySelectorAll(".folio-desktop-nav__list > li > a, .folio-nav-menu__trigger")]
        .filter((element) => element.scrollWidth > element.clientWidth + 1).length,
    })),
  );
  await page.screenshot({ path: join(shots, "02-tablet-820.png") });
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
      desktopNavHidden: getComputedStyle(document.querySelector(".folio-desktop-nav")).display === "none",
      menuButtonVisible: getComputedStyle(document.querySelector(".folio-mobile-menu-button")).display !== "none",
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      brandOverlapsActions: brand.right > actions.left,
    };
  });
  await page.screenshot({ path: join(shots, `03-phone-${width}-closed.png`) });

  await page.locator(".folio-mobile-menu-button").tap();
  await page.waitForTimeout(320);
  const opened = await page.evaluate(() => {
    const panel = document.querySelector(".folio-mobile-panel");
    return {
      visibility: getComputedStyle(panel).visibility,
      top: Math.round(panel.getBoundingClientRect().top),
      width: Math.round(panel.getBoundingClientRect().width),
      accordionTriggers: document.querySelectorAll(".folio-mobile-group__trigger").length,
      plainLinks: document.querySelectorAll(".folio-mobile-panel nav > a").length,
      desktopPanelInsideMobile: document.querySelectorAll(".folio-mobile-panel .folio-nav-menu__panel").length,
      // The reading-task grouping has to survive the mobile treatment; a flat
      // list there would mean the structure only exists on desktop.
      groupLabelsInAccordion: document.querySelectorAll(
        ".folio-mobile-panel .folio-mobile-group__label",
      ).length,
    };
  });
  await page.screenshot({ path: join(shots, `04-phone-${width}-panel.png`) });

  let accordion = null;
  if (opened.accordionTriggers > 0) {
    await page.locator(".folio-mobile-group__trigger").first().tap();
    await page.waitForTimeout(320);
    // A labelled task section, not the overview row, so the tap proves a real
    // task link is reachable on a phone.
    const firstChild = page
      .locator(".folio-mobile-group__section")
      .filter({ has: page.locator(".folio-mobile-group__label") })
      .first()
      .locator("a")
      .first();
    accordion = {
      expanded: await page
        .locator(".folio-mobile-group__trigger")
        .first()
        .getAttribute("aria-expanded"),
      childVisible: await firstChild.isVisible(),
    };
    await page.screenshot({ path: join(shots, `05-phone-${width}-accordion.png`) });

    await firstChild.tap();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    accordion.navigatedTo = new URL(page.url()).pathname;
    accordion.panelClosedAfterNavigation = await page.evaluate(
      () => getComputedStyle(document.querySelector(".folio-mobile-panel")).visibility === "hidden",
    );
  }
  record(`phone ${width}`, { closed, opened, accordion });
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
      panel: getComputedStyle(document.querySelector(".folio-nav-menu__panel")).transitionDuration,
      mobilePanel: getComputedStyle(document.querySelector(".folio-mobile-panel")).transitionDuration,
      chevron: getComputedStyle(document.querySelector(".folio-nav-menu__trigger svg"))
        .transitionDuration,
    })),
  );
  await context.close();
}

// --------------------------------------------------------------- keyboard ---
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  await page.keyboard.press("Tab");
  record(
    "keyboard opens and reaches the panel",
    await page.evaluate(() => ({
      expanded: document.querySelector(".folio-nav-menu__trigger")?.getAttribute("aria-expanded"),
      panelVisible:
        getComputedStyle(document.querySelector(".folio-nav-menu__panel")).visibility === "visible",
      focusedElement: document.activeElement.tagName,
      focusedIsEntry: document.activeElement.classList.contains("folio-nav-menu__entry"),
    })),
  );
  await page.screenshot({ path: join(shots, "06-keyboard-panel.png") });
  await page.close();
}

await browser.close();
writeFileSync(join(OUT, "results.json"), JSON.stringify(results, null, 2) + "\n");
console.log(`\n${results.length} checks recorded in ${join(OUT, "results.json")}`);
