import type {
  FolioNavigationChild,
  FolioNavigationItem,
  FolioNavigationPanel,
} from "../types";

// Navigation is a Core concern: the same resolved model feeds the React header
// and any consumer that needs to reason about links. Keeping it free of React
// is also what lets this module be unit-tested without a DOM.

/** A plain top-level link. The shape existing Folio consumers already have. */
export type FolioNavLinkItem = {
  kind: "link";
  label: string;
  href: string;
};

/** One link inside a resolved dropdown. */
export type FolioNavMenuEntry = {
  label: string;
  href: string;
  icon?: string;
  description?: string;
  /** Reading-task group this entry belongs to, when one was configured. */
  group?: string;
};

/**
 * A run of dropdown entries that share a reading-task group. Consumers that do
 * not care about grouping can read `menu.entries`, which is always flat.
 */
export type FolioNavMenuGroup = {
  /** Group heading. Absent for entries that were configured without a group. */
  label?: string;
  entries: FolioNavMenuEntry[];
};

/** A top-level entry that opens a structured dropdown. */
export type FolioNavMenuItem = {
  kind: "menu";
  label: string;
  href: string;
  panel: {
    eyebrow?: string;
    title: string;
    description?: string;
  };
  entries: FolioNavMenuEntry[];
  /**
   * The same entries as `entries`, split into configured reading-task groups.
   * A menu configured without groups yields a single unlabelled group, so the
   * two views never disagree about what is in the panel.
   */
  groups: FolioNavMenuGroup[];
};

export type FolioResolvedNavItem = FolioNavLinkItem | FolioNavMenuItem;

/**
 * Normalize a document path for comparison and for `Link to=`. The root keeps
 * its trailing slash because `fol.io/` and `fol.io` are the same route.
 */
export function folioNavHref(path: string): string {
  return path === "/" ? "/" : path.replace(/\/$/, "");
}

function resolveEntries(
  children: readonly FolioNavigationChild[] | undefined,
): FolioNavMenuEntry[] {
  if (!Array.isArray(children)) return [];

  const entries: FolioNavMenuEntry[] = [];
  for (const child of children) {
    if (!child || typeof child.label !== "string" || typeof child.href !== "string") {
      continue;
    }
    const label = child.label.trim();
    const href = child.href.trim();
    if (!label || !href) continue;
    entries.push({
      label,
      href: folioNavHref(href),
      icon: typeof child.icon === "string" && child.icon ? child.icon : undefined,
      description:
        typeof child.description === "string" && child.description.trim()
          ? child.description.trim()
          : undefined,
      group:
        typeof child.group === "string" && child.group.trim()
          ? child.group.trim()
          : undefined,
    });
  }
  return entries;
}

function resolvePanel(
  item: FolioNavigationItem,
  panel: FolioNavigationPanel | undefined,
): FolioNavMenuItem["panel"] {
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : undefined;

  return {
    eyebrow: text(panel?.eyebrow),
    title: text(panel?.title) ?? item.label,
    description: text(panel?.description),
  };
}

/**
 * Turn configured navigation into the model the default header renders.
 *
 * Backwards compatibility is the whole point of this function: an entry
 * without usable `children` resolves to the same plain link it always was, and
 * entries with malformed children lose only the malformed rows.
 *
 * A dropdown also receives one generated entry pointing at the item's own
 * `href`, so the section root stays reachable even when the trigger click is
 * spent opening the panel. That entry is skipped when a child already targets
 * the same route, which keeps configuration honest instead of duplicating a
 * link.
 */
export function resolveFolioNavigation(
  items: readonly FolioNavigationItem[] | undefined,
): FolioResolvedNavItem[] {
  if (!Array.isArray(items)) return [];

  const resolved: FolioResolvedNavItem[] = [];
  for (const item of items) {
    if (!item || typeof item.label !== "string" || typeof item.href !== "string") {
      continue;
    }
    const label = item.label.trim();
    const href = folioNavHref(item.href.trim());
    if (!label || !href) continue;

    const entries = resolveEntries(item.children);
    if (entries.length === 0) {
      resolved.push({ kind: "link", label, href });
      continue;
    }

    const panel = resolvePanel({ ...item, label, href }, item.panel);
    const overviewLabel =
      typeof item.panel?.overviewLabel === "string" && item.panel.overviewLabel.trim()
        ? item.panel.overviewLabel.trim()
        : `全部${label}`;

    if (!entries.some((entry) => entry.href === href)) {
      // The overview entry is deliberately ungrouped: it is the section root,
      // not a step in any reading task.
      entries.unshift({ label: overviewLabel, href });
    }

    resolved.push({
      kind: "menu",
      label,
      href,
      panel,
      entries,
      groups: groupEntries(entries),
    });
  }
  return resolved;
}

/**
 * Split entries into reading-task groups, preserving first-seen order.
 *
 * Ungrouped entries are hoisted to the front in one unlabelled run, so a
 * configuration that only labels some children still reads top-down instead of
 * scattering stray links between headings. A panel with no groups at all comes
 * back as exactly one unlabelled group, which is what renders when a consumer
 * never adopts `group`.
 */
export function groupEntries(
  entries: readonly FolioNavMenuEntry[],
): FolioNavMenuGroup[] {
  const ungrouped: FolioNavMenuEntry[] = [];
  const order: string[] = [];
  const buckets = new Map<string, FolioNavMenuEntry[]>();

  for (const entry of entries) {
    if (!entry.group) {
      ungrouped.push(entry);
      continue;
    }
    let bucket = buckets.get(entry.group);
    if (!bucket) {
      bucket = [];
      buckets.set(entry.group, bucket);
      order.push(entry.group);
    }
    bucket.push(entry);
  }

  const groups: FolioNavMenuGroup[] = [];
  if (ungrouped.length > 0) groups.push({ entries: ungrouped });
  for (const label of order) {
    groups.push({ label, entries: buckets.get(label) ?? [] });
  }
  return groups;
}

/**
 * Whether a navigation entry represents the current route. A dropdown is
 * active when its own route or any of its visible entries matches, which is
 * what a reader expects after landing on a nested page.
 */
export function isFolioNavItemActive(
  item: FolioResolvedNavItem,
  pathname: string,
): boolean {
  const current = folioNavHref(pathname);
  const matches = (href: string) =>
    current === href || (href !== "/" && current.startsWith(`${href}/`));

  if (matches(item.href)) return true;
  return item.kind === "menu" && item.entries.some((entry) => matches(entry.href));
}
