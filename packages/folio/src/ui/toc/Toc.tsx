import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { FolioHeading } from "../../types";
import { buildFolioOutlineTree, type FolioOutlineNode } from "../../core/outline";

export type FolioTocProps = {
  headings: readonly FolioHeading[];
  className?: string;
  onNavigate?: () => void;
  /** Panel heading. Defaults to 本页目录. */
  title?: string;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function findTocLink(
  container: HTMLElement | null,
  id: string,
): HTMLAnchorElement | undefined {
  if (!container) return undefined;
  return Array.from(
    container.querySelectorAll<HTMLAnchorElement>("a[data-folio-toc-id]"),
  ).find((link) => link.dataset.folioTocId === id);
}

function scrollMarginTop(element: Element): number {
  return Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
}

/**
 * Active heading follows the reading position: no highlight at the very top,
 * the last heading at the page bottom, and otherwise the last heading whose
 * scroll-margin has crossed the viewport top. Throttled to one frame, matching
 * VitePress's scroll-driven outline without its 100ms lag.
 */
function useActiveFolioHeading(
  headings: readonly FolioHeading[],
  containerRef: RefObject<HTMLDivElement | null>,
): string {
  const [active, setActive] = useState("");

  useEffect(() => {
    if (!headings.length) {
      setActive("");
      return;
    }

    let frame = 0;
    let previous = "";

    const update = () => {
      frame = 0;
      const nodes = headings
        .map(({ id }) => document.getElementById(id))
        .filter((node): node is HTMLElement => Boolean(node));

      if (!nodes.length) {
        previous = "";
        setActive("");
        return;
      }

      let next = "";

      if (window.scrollY >= 1) {
        const atBottom =
          window.scrollY + window.innerHeight - document.body.offsetHeight >= 0;
        if (atBottom) {
          next = headings.at(-1)?.id ?? "";
        } else {
          for (const node of nodes) {
            if (node.getBoundingClientRect().top > scrollMarginTop(node) + 4) {
              break;
            }
            next = node.id;
          }
        }
      }

      setActive(next);

      if (next !== previous) {
        previous = next;
        const link = findTocLink(containerRef.current, next);
        if (link) {
          link.scrollIntoView({
            block: "nearest",
            behavior: prefersReducedMotion() ? "auto" : "smooth",
          });
        }
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [headings, containerRef]);

  return active;
}

function FolioOutlineList({
  nodes,
  depth,
  activeId,
  onNavigate,
}: {
  nodes: readonly FolioOutlineNode[];
  depth: number;
  activeId: string;
  onNavigate?: () => void;
}) {
  return (
    <ul
      className={
        "folio-toc__list" + (depth ? " folio-toc__list--nested" : "")
      }
    >
      {nodes.map((node) => (
        <li className={"folio-toc-depth-" + node.depth} key={node.id}>
          <a
            className={activeId === node.id ? "active" : ""}
            aria-current={activeId === node.id ? "location" : undefined}
            href={"#" + node.id}
            title={node.text}
            data-folio-toc-id={node.id}
            onClick={onNavigate}
          >
            {node.text}
          </a>
          {node.children.length ? (
            <FolioOutlineList
              nodes={node.children}
              depth={depth + 1}
              activeId={activeId}
              onNavigate={onNavigate}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Reusable article/document table of contents for Folio's parsed headings. */
export function FolioToc({
  headings,
  className,
  onNavigate,
  title = "本页目录",
}: FolioTocProps) {
  const tree = useMemo(() => buildFolioOutlineTree(headings), [headings]);
  const contentRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const activeHeading = useActiveFolioHeading(headings, contentRef);

  useLayoutEffect(() => {
    const content = contentRef.current;
    const marker = markerRef.current;
    if (!content || !marker) return;

    const position = () => {
      const link = findTocLink(content, activeHeading);
      if (!link) {
        marker.style.opacity = "0";
        marker.style.top = "";
        return;
      }
      const top =
        link.getBoundingClientRect().top -
        content.getBoundingClientRect().top +
        (link.offsetHeight - marker.offsetHeight) / 2;
      marker.style.top = top + "px";
      marker.style.opacity = "1";
    };

    position();
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(position);
    observer?.observe(content);
    window.addEventListener("resize", position);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", position);
    };
  }, [activeHeading, tree]);

  if (!headings.length) return null;

  return (
    <nav
      className={["folio-toc", className].filter(Boolean).join(" ")}
      aria-label={title}
    >
      <div className="folio-toc__content" ref={contentRef}>
        <h2>{title}</h2>
        <FolioOutlineList
          nodes={tree}
          depth={0}
          activeId={activeHeading}
          onNavigate={onNavigate}
        />
        <span
          ref={markerRef}
          className="folio-toc__marker"
          aria-hidden="true"
        />
      </div>
    </nav>
  );
}
