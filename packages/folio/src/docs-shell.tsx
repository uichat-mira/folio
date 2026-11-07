import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FolioDocumentBody } from "./document-body";
import { FolioToc, type FolioTocProps } from "./ui/toc";
import { buildFolioNavigationTree, getFolioNavigationNeighbors } from "./core/navigation-tree";
import { FolioTreeNav, type FolioTreeNavProps } from "./ui/tree-nav";
import { FolioPageNav } from "./ui/page-nav";
import { findFolioDocCollection } from "./core/docs-structure";
import type { FolioDoc, FolioPageNavNeighbors } from "./types";

export type FolioDocsShellProps = {
  doc: FolioDoc;
  docs: FolioDoc[];
  footer?: ReactNode;
  /** @deprecated The documentation toolbar was removed; this option is kept for source compatibility. */
  share?: boolean;
  children?: ReactNode;
  /** Overrides both desktop and mobile document navigation renderings. */
  renderNav?: (props: FolioTreeNavProps) => ReactNode;
  /** Overrides both desktop and mobile page TOCs. */
  renderToc?: (props: FolioTocProps) => ReactNode;
  /** Optional explicit previous/next override; otherwise follows the navigation tree. */
  pageNeighbors?: FolioPageNavNeighbors;
  /** Accessible drawer name for different reading contexts. */
  menuLabel?: string;
};

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
  const mobileTocId = useId();
  const mobileTocRef = useRef<HTMLDivElement>(null);
  const mobileTocButtonRef = useRef<HTMLButtonElement>(null);
  const tree = useMemo(() => buildFolioNavigationTree(docs, doc), [docs, doc]);
  const neighbors = pageNeighbors ?? getFolioNavigationNeighbors(tree, doc.path);

  // The exact same navigation tree and renderer back desktop and mobile.
  const navigation = (onNavigate?: () => void) => {
    const props: FolioTreeNavProps = { tree, currentPath: doc.path, onNavigate };
    return renderNav ? renderNav(props) : <FolioTreeNav {...props} />;
  };
  const toc = (onNavigate?: () => void) => {
    const props: FolioTocProps = { headings: doc.headings, onNavigate };
    return renderToc ? renderToc(props) : <FolioToc {...props} />;
  };

  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileTocOpen(false);
  }, [doc.path]);

  // The outline panel is a fixed flyout: Escape, an outside press and body
  // scroll lock keep it from trapping the reader or nudging the page behind it.
  useEffect(() => {
    if (!mobileTocOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileTocOpen(false);
      mobileTocButtonRef.current?.focus();
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        mobileTocRef.current?.contains(target) ||
        mobileTocButtonRef.current?.contains(target)
      ) {
        return;
      }
      setMobileTocOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [mobileTocOpen]);

  return (
    <div className="folio-docs-runtime">
      <div
        className={
          "folio-docs-mobile-bar" +
          (doc.headings.length ? "" : " folio-docs-mobile-bar--no-toc")
        }
      >
        <button
          type="button"
          className="folio-docs-mobile-bar__menu"
          onClick={() => {
            setMobileTocOpen(false);
            setMobileMenuOpen(true);
          }}
        >
          菜单
        </button>
        <button
          ref={mobileTocButtonRef}
          type="button"
          className="folio-docs-mobile-bar__toc"
          disabled={!doc.headings.length}
          aria-expanded={doc.headings.length ? mobileTocOpen : undefined}
          aria-controls={doc.headings.length ? mobileTocId : undefined}
          onClick={() => {
            setMobileMenuOpen(false);
            setMobileTocOpen((value) => !value);
          }}
        >
          页面导航
        </button>
      </div>

      <div
        className={
          "folio-docs-overlay" + (mobileMenuOpen ? " is-open" : "")
        }
        role="presentation"
        aria-hidden={!mobileMenuOpen}
        inert={!mobileMenuOpen}
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

      {/* Mounted while closed so the panel can animate out instead of
          disappearing; inert keeps its links out of the focus order. */}
      <div
        id={mobileTocId}
        ref={mobileTocRef}
        className={"folio-mobile-toc" + (mobileTocOpen ? " is-open" : "")}
        aria-hidden={!mobileTocOpen}
        inert={!mobileTocOpen}
      >
        <div className="folio-mobile-toc__head">
          <span>页面导航</span>
          <button type="button" onClick={() => setMobileTocOpen(false)}>
            关闭
          </button>
        </div>
        {toc(() => setMobileTocOpen(false))}
      </div>

      <div className="folio-docs-shell">
        {navigation()}

        <main className="folio-doc-main">
          <FolioDocumentBody doc={doc}>{children}</FolioDocumentBody>
          {footer}
          <FolioPageNav
            previous={neighbors.previous}
            next={neighbors.next}
          />
        </main>

        {toc()}
      </div>
    </div>
  );
}
