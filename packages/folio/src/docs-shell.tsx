import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { FolioMarkdown } from "./markdown-react";
import { FolioToc, type FolioTocProps } from "./ui/toc";
import { FolioDocNav, type FolioDocNavProps } from "./ui/doc-nav";
import {
  findFolioDocCollection,
  getFolioDocNeighbors,
} from "./core/docs-structure";
import type { FolioDoc } from "./types";

export type FolioDocsShellProps = {
  doc: FolioDoc;
  docs: FolioDoc[];
  footer?: ReactNode;
  /** @deprecated The documentation toolbar was removed; this option is kept for source compatibility. */
  share?: boolean;
  children?: ReactNode;
  /** Overrides both desktop and mobile document navigation renderings. */
  renderNav?: (props: FolioDocNavProps) => ReactNode;
  /** Overrides both desktop and mobile page TOCs. */
  renderToc?: (props: FolioTocProps) => ReactNode;
  /** Optional directory-based previous/next ordering for portal trees. */
  pageNeighbors?: { previous?: FolioDoc; next?: FolioDoc };
  /** Accessible drawer name for different reading contexts. */
  menuLabel?: string;
};

function FolioPager({
  previous,
  next,
}: {
  previous?: FolioDoc;
  next?: FolioDoc;
}) {
  if (!previous && !next) return null;

  return (
    <nav className="folio-page-nav" aria-label="文档分页">
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

export function FolioDocsShell({
  doc,
  docs,
  footer,
  children,
  renderNav,
  renderToc,
  pageNeighbors,
  menuLabel = "文档菜单",
}: FolioDocsShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const neighbors = pageNeighbors ?? getFolioDocNeighbors(docs, doc);

  // The same public components back desktop and mobile, while consumer render
  // functions receive route-specific data and close callbacks on mobile.
  const navigation = (onNavigate?: () => void) => {
    const props: FolioDocNavProps = { doc, docs, onNavigate };
    return renderNav ? renderNav(props) : <FolioDocNav {...props} />;
  };
  const toc = (onNavigate?: () => void) => {
    const props: FolioTocProps = { headings: doc.headings, onNavigate };
    return renderToc ? renderToc(props) : <FolioToc {...props} />;
  };

  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileTocOpen(false);
  }, [doc.path]);

  return (
    <div className="folio-docs-runtime">
      <div className="folio-docs-mobile-bar">
        <button
          type="button"
          onClick={() => {
            setMobileTocOpen(false);
            setMobileMenuOpen(true);
          }}
        >
          菜单
        </button>
        <button
          type="button"
          disabled={!doc.headings.length}
          aria-expanded={doc.headings.length ? mobileTocOpen : undefined}
          onClick={() => {
            setMobileMenuOpen(false);
            setMobileTocOpen((value) => !value);
          }}
        >
          页面导航
        </button>
      </div>

      {mobileMenuOpen ? (
        <div
          className="folio-docs-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <aside className="folio-docs-drawer" aria-label={menuLabel}>
            <div className="folio-docs-drawer__head">
              <span>菜单</span>
              <button type="button" onClick={() => setMobileMenuOpen(false)}>
                关闭
              </button>
            </div>
            {navigation(() => setMobileMenuOpen(false))}
          </aside>
        </div>
      ) : null}

      {mobileTocOpen ? (
        <div className="folio-mobile-toc">
          <div className="folio-mobile-toc__head">
            <span>页面导航</span>
            <button type="button" onClick={() => setMobileTocOpen(false)}>
              关闭
            </button>
          </div>
          {toc(() => setMobileTocOpen(false))}
        </div>
      ) : null}

      <div className="folio-docs-shell">
        {navigation()}

        <main className="folio-doc-main">
          <h1>{doc.title}</h1>
          {doc.description ? (
            <p className="folio-lede">{doc.description}</p>
          ) : null}
          {children ?? (
            <FolioMarkdown
              source={doc.body}
              options={{ removeH1: true }}
            />
          )}
          {footer}
          <FolioPager
            previous={neighbors.previous}
            next={neighbors.next}
          />
        </main>

        {toc()}
      </div>
    </div>
  );
}
