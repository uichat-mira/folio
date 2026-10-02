import { useMemo, type ReactNode } from "react";
import { marked } from "marked";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { normalizeBasePath } from "./config";
import type { FolioDoc, FolioAppProps } from "./types";

function href(path: string): string {
  return path === "/" ? "/" : path.replace(/\/$/, "");
}

function groupDocs(docs: FolioDoc[]): Array<[string, FolioDoc[]]> {
  const groups = new Map<string, FolioDoc[]>();
  for (const doc of docs) {
    const current = groups.get(doc.group) ?? [];
    current.push(doc);
    groups.set(doc.group, current);
  }
  return [...groups.entries()];
}

function Markdown({ doc }: { doc: FolioDoc }) {
  const html = useMemo(() => marked.parse(doc.body) as string, [doc.body]);
  return (
    <article
      className="folio-markdown"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function DocumentPage({
  doc,
  footer,
}: {
  doc: FolioDoc;
  footer?: ReactNode;
}) {
  return (
    <main className="folio-doc-page">
      <div className="folio-eyebrow">{doc.group}</div>
      <h1>{doc.title}</h1>
      {doc.description && <p className="folio-lede">{doc.description}</p>}
      <Markdown doc={doc} />
      {footer}
    </main>
  );
}

function Home({
  docs,
  title,
  description,
  custom,
}: {
  docs: FolioDoc[];
  title: string;
  description: string;
  custom?: ReactNode;
}) {
  if (custom) return <>{custom}</>;
  const featured = docs.filter((doc) => doc.path !== "/").slice(0, 8);

  return (
    <main className="folio-home">
      <section className="folio-hero">
        <div className="folio-eyebrow">FOLIO</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
      <section className="folio-card-grid">
        {featured.map((doc) => (
          <Link key={doc.path} to={href(doc.path)} className="folio-card">
            <span>{doc.group}</span>
            <h2>{doc.title}</h2>
            <p>{doc.description}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}

function Shell({
  config,
  docs,
  slots,
}: Omit<FolioAppProps, "basePath">) {
  const location = useLocation();
  const groups = groupDocs(docs);
  const current = docs.find(
    (doc) => href(doc.path) === href(location.pathname),
  );

  return (
    <div className="folio-shell">
      <header className="folio-header">
        <Link to="/" className="folio-brand">
          {config.logo && <img src={config.logo} alt="" />}
          <span>{config.title}</span>
        </Link>
        <nav>
          {(config.navigation ?? [
            { label: "文档", href: "/docs" },
            { label: "博客", href: "/blogs" },
            { label: "项目", href: "/projects" },
          ]).map((item) => (
            <Link key={item.href} to={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="folio-header-actions">{slots?.headerActions}</div>
      </header>

      <div className="folio-layout">
        <aside className="folio-sidebar">
          {groups.map(([group, items]) => (
            <section key={group}>
              <h2>{group}</h2>
              {items.map((doc) => (
                <Link
                  key={doc.path}
                  className={current?.path === doc.path ? "active" : ""}
                  to={href(doc.path)}
                >
                  {doc.title}
                </Link>
              ))}
            </section>
          ))}
        </aside>

        <div className="folio-content">
          <Routes>
            <Route
              path="/"
              element={
                <Home
                  docs={docs}
                  title={config.title}
                  description={config.description}
                  custom={slots?.home}
                />
              }
            />
            {docs.map((doc) => (
              <Route
                key={doc.path}
                path={href(doc.path)}
                element={
                  <DocumentPage
                    doc={doc}
                    footer={slots?.articleFooter}
                  />
                }
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <footer className="folio-footer">
            {config.footer ?? "Built with Folio."}
          </footer>
        </div>
      </div>
    </div>
  );
}

export function FolioApp({
  config,
  docs,
  basePath = "/",
  slots,
}: FolioAppProps) {
  const basename = normalizeBasePath(basePath);

  return (
    <BrowserRouter
      basename={basename === "/" ? undefined : basename.replace(/\/$/, "")}
    >
      <Shell config={config} docs={docs} slots={slots} />
    </BrowserRouter>
  );
}
