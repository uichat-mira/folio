// Core outline model: turns the flat heading list produced by the parser into
// the nested tree shared by the React TOC and static publishing. This module
// must stay free of React so Build code can depend on it directly.
import type { FolioHeading } from "../types";

export type FolioOutlineNode = FolioHeading & {
  children: FolioOutlineNode[];
};

/**
 * Nest headings by level (h2 contains h3, h3 contains h4). Headings outside
 * `minLevel`–`maxLevel` are skipped, matching the parser's h2–h4 extraction.
 * A heading whose level jumps (h2 -> h4) becomes a child of the nearest
 * shallower heading, so the sidebar never loses an entry.
 */
export function buildFolioOutlineTree(
  headings: readonly FolioHeading[],
  options: { minLevel?: number; maxLevel?: number } = {},
): FolioOutlineNode[] {
  const minLevel = options.minLevel ?? 2;
  const maxLevel = options.maxLevel ?? 4;
  const roots: FolioOutlineNode[] = [];
  const stack: FolioOutlineNode[] = [];

  for (const heading of headings) {
    if (heading.depth < minLevel || heading.depth > maxLevel) continue;

    const node: FolioOutlineNode = { ...heading, children: [] };

    while (stack.length && stack.at(-1)!.depth >= node.depth) stack.pop();

    const parent = stack.at(-1);
    if (parent) parent.children.push(node);
    else roots.push(node);

    stack.push(node);
  }

  return roots;
}
