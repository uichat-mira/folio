import { Link } from "react-router-dom";
import type { FolioPageNavNeighbors } from "../../types";

export type FolioPageNavProps = FolioPageNavNeighbors & {
  className?: string;
  ariaLabel?: string;
};

/** Navigation only: callers decide how previous and next are ordered. */
export function FolioPageNav({
  previous,
  next,
  className,
  ariaLabel = "文档分页",
}: FolioPageNavProps) {
  if (!previous && !next) return null;

  return (
    <nav
      className={["folio-page-nav", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
    >
      {previous ? (
        <Link className="folio-page-nav__previous" to={previous.path}>
          <span>上一篇</span>
          <strong>{previous.title}</strong>
        </Link>
      ) : <span />}
      {next ? (
        <Link className="folio-page-nav__next" to={next.path}>
          <span>下一篇</span>
          <strong>{next.title}</strong>
        </Link>
      ) : <span />}
    </nav>
  );
}
