import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { FolioMarkdown } from "./markdown-react";
import { FolioShareButton } from "./share";
import { FolioToc } from "./toc";
import {
  findFolioDocCollection,
  getFolioDocNeighbors,
} from "./core/docs-structure";
import type { FolioDoc } from "./types";

export type FolioDocsShellProps = {
  doc: FolioDoc;
  docs: FolioDoc[];
  footer?: ReactNode;
  share?: boolean;
  children?: ReactNode;
};

function FolioDocNav({
  doc,
  docs,
  onNavigate,
}: {
  doc: FolioDoc;
  docs: FolioDoc[];
  onNavigate?: () => void;
}) {
  const collection = findFolioDocCollection(docs, doc);
  if (!collection) return null;

  return (
    <nav className="folio-docnav" aria-label="文档目录">
      <div className="folio-docnav__collection">{collection.title}</div>
      {collection.sections.map((section) => (
        <section key={section.id}>
          <h2>{section.title}</h2>
          <ul>
            {section.docs.map((item) => (
              <li key={item.path}>
                <Link
                  className={item.path === doc.path ? "active" : ""}
                  aria-current={item.path === doc.path ? "page" : undefined}
                  to={item.path}
                  onClick={onNavigate}
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}

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
  share = true,
  children,
}: FolioDocsShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const neighbors = getFolioDocNeighbors(docs, doc);

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
          <aside className="folio-docs-drawer" aria-label="文档菜单">
            <div className="folio-docs-drawer__head">
              <span>菜单</span>
              <button type="button" onClick={() => setMobileMenuOpen(false)}>
                关闭
              </button>
            </div>
            <FolioDocNav
              doc={doc}
              docs={docs}
              onNavigate={() => setMobileMenuOpen(false)}
            />
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
          <FolioToc
            headings={doc.headings}
            onNavigate={() => setMobileTocOpen(false)}
          />
        </div>
      ) : null}

      <div className="folio-docs-shell">
        <FolioDocNav doc={doc} docs={docs} />

        <main className="folio-doc-main">
          <div className="folio-doc-toolbar">
            <div className="folio-eyebrow">{doc.group}</div>
            {share ? (
              <FolioShareButton
                title={doc.title}
                text={doc.description}
              />
            ) : null}
          </div>
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

        <FolioToc headings={doc.headings} />
      </div>
    </div>
  );
}
