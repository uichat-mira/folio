import { useEffect, useState } from "react";
import type { FolioHeading } from "./types";

export type FolioTocProps = {
  headings: readonly FolioHeading[];
  className?: string;
  onNavigate?: () => void;
};

function useActiveFolioHeading(headings: readonly FolioHeading[]): string {
  const [active, setActive] = useState("");

  useEffect(() => {
    if (!headings.length) {
      setActive("");
      return;
    }
    const nodes = headings
      .map(({ id }) => document.getElementById(id))
      .filter((node): node is HTMLElement => Boolean(node));
    if (!nodes.length) {
      setActive("");
      return;
    }

    // Reading the last heading above the sticky header is more robust than
    // assuming an IntersectionObserver event fires for every scroll position.
    let scheduled = false;
    const update = () => {
      scheduled = false;
      const visible = nodes.filter((node) => node.getBoundingClientRect().top <= 145);
      const current = visible.at(-1) ?? nodes[0];
      setActive(current.id);
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [headings]);

  return active;
}

/** Reusable article/document table of contents for Folio's parsed headings. */
export function FolioToc({ headings, className, onNavigate }: FolioTocProps) {
  const activeHeading = useActiveFolioHeading(headings);
  if (!headings.length) return null;
  return (
    <aside
      className={["folio-toc", className].filter(Boolean).join(" ")}
      aria-label="本页目录"
    >
      <h2>本页目录</h2>
      <ul>
        {headings.map((heading) => (
          <li key={heading.id} className={"folio-toc-depth-" + heading.depth}>
            <a
              className={activeHeading === heading.id ? "active" : ""}
              aria-current={activeHeading === heading.id ? "location" : undefined}
              href={"#" + heading.id}
              onClick={onNavigate}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
