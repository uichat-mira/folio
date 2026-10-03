import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { normalizeBasePath } from "./config";
import { FolioHeader } from "./header";
import { SearchIcon } from "./icons";
import { FolioShareButton } from "./share";
import { FolioMarkdown } from "./markdown-react";
import { searchFolioDocs } from "./search";
import type {
  FolioAppProps,
  FolioDoc,
  FolioThemePreference,
  FolioUiOptions,
} from "./types";

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

function resolveInitialTheme(preference: FolioThemePreference): "light" | "dark" {
  if (typeof window === "undefined") return preference === "dark" ? "dark" : "light";
  const saved = window.localStorage.getItem("folio-theme");
  if (saved === "light" || saved === "dark") return saved;
  if (preference === "light" || preference === "dark") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function DocumentPage({
  doc,
  footer,
  share,
}: {
  doc: FolioDoc;
  footer?: ReactNode;
  share: boolean;
}) {
  return (
    <main className="folio-doc-page">
      <div className="folio-doc-toolbar">
        <div className="folio-eyebrow">{doc.group}</div>
        {share ? <FolioShareButton title={doc.title} text={doc.description} /> : null}
      </div>
      <h1>{doc.title}</h1>
      {doc.description && <p className="folio-lede">{doc.description}</p>}
      <FolioMarkdown source={doc.body} options={{ removeH1: true }} />
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

function SearchOverlay({
  docs,
  onClose,
}: {
  docs: FolioDoc[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchFolioDocs(docs, query), [docs, query]);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => setActiveIndex(0), [query]);

  function openResult(index: number) {
    const result = results[index];
    if (!result) return;
    navigate(href(result.path));
    onClose();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      openResult(activeIndex);
    }
  }

  return (
    <div
      className="folio-search-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="folio-search-dialog" role="dialog" aria-modal="true" aria-label="搜索内容">
        <div className="folio-search-input-wrap">
          <SearchIcon />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索标题、正文、分组或标签..."
            aria-label="搜索内容"
          />
          <button type="button" onClick={onClose}>Esc</button>
        </div>
        <div className="folio-search-results" role="listbox" aria-label="搜索结果">
          {results.length ? results.map((doc, index) => (
            <button
              type="button"
              role="option"
              aria-selected={activeIndex === index}
              className={activeIndex === index ? "active" : ""}
              key={doc.path}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => openResult(index)}
            >
              <strong>{doc.title}</strong>
              <span>{doc.group}{doc.description ? " · " + doc.description : ""}</span>
            </button>
          )) : <p className="folio-search-empty">没有找到匹配内容</p>}
        </div>
        <footer className="folio-search-footer">
          <span>↑↓ 选择</span><span>Enter 打开</span><span>Esc 关闭</span>
        </footer>
      </section>
    </div>
  );
}

function NotFound({ searchEnabled, onSearch }: { searchEnabled: boolean; onSearch: () => void }) {
  return (
    <main className="folio-not-found">
      <span>404</span>
      <h1>这条路径没有内容</h1>
      <p>页面可能已经移动、删除，或者地址输入有误。</p>
      <div>
        <Link to="/" className="folio-button folio-button--primary">返回首页</Link>
        {searchEnabled ? (
          <button type="button" className="folio-button" onClick={onSearch}>搜索内容</button>
        ) : null}
      </div>
    </main>
  );
}

function Shell({
  config,
  docs,
  slots,
  ui,
}: Omit<FolioAppProps, "basePath">) {
  const location = useLocation();
  const groups = groupDocs(docs);
  const current = docs.find((doc) => href(doc.path) === href(location.pathname));
  const navigation = config.navigation ?? [
    { label: "文档", href: "/docs" },
    { label: "博客", href: "/blogs" },
    { label: "项目", href: "/projects" },
  ];
  const searchEnabled = ui?.search !== false;
  const themeEnabled = ui?.theme !== false;
  const shareEnabled = ui?.share !== false;
  const themePreference = ui?.defaultTheme ?? "system";
  const [searchOpen, setSearchOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(
    () => resolveInitialTheme(themePreference),
  );

  useEffect(() => {
    setSearchOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (!themeEnabled) return;
    document.documentElement.dataset.folioTheme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("folio-theme", theme);
  }, [theme, themeEnabled]);

  useEffect(() => {
    if (!searchEnabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchEnabled]);

  function openSearch() {
    setSearchOpen(true);
  }

  function toggleTheme() {
    setTheme((value) => value === "dark" ? "light" : "dark");
  }

  return (
    <div className="folio-shell">
      <FolioHeader
        config={config}
        navigation={navigation}
        currentDoc={current}
        searchEnabled={searchEnabled}
        themeEnabled={themeEnabled}
        shareEnabled={shareEnabled}
        darkMode={theme === "dark"}
        onSearch={openSearch}
        onToggleTheme={toggleTheme}
        actions={slots?.headerActions}
      />

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
              element={<Home docs={docs} title={config.title} description={config.description} custom={slots?.home} />}
            />
            {docs.map((doc) => (
              <Route
                key={doc.path}
                path={href(doc.path)}
                element={<DocumentPage doc={doc} footer={slots?.articleFooter} share={shareEnabled} />}
              />
            ))}
            <Route path="*" element={<NotFound searchEnabled={searchEnabled} onSearch={openSearch} />} />
          </Routes>
          <footer className="folio-footer">{config.footer ?? "Built with Folio."}</footer>
        </div>
      </div>

      {searchOpen ? <SearchOverlay docs={docs} onClose={() => setSearchOpen(false)} /> : null}
    </div>
  );
}

export function FolioApp({
  config,
  docs,
  basePath = "/",
  slots,
  ui,
}: FolioAppProps) {
  const basename = normalizeBasePath(basePath);

  return (
    <BrowserRouter basename={basename === "/" ? undefined : basename.replace(/\/$/, "")}>
      <Shell config={config} docs={docs} slots={slots} ui={ui} />
    </BrowserRouter>
  );
}
