import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { FolioShareButton } from "./share";
import { GithubIcon, MenuIcon, SearchIcon, ThemeIcon } from "./icons";
import type {
  FolioConfig,
  FolioDoc,
  FolioNavigationItem,
} from "./types";

export type FolioHeaderProps = {
  config: FolioConfig;
  navigation?: FolioNavigationItem[];
  currentDoc?: FolioDoc;
  searchEnabled?: boolean;
  themeEnabled?: boolean;
  shareEnabled?: boolean;
  darkMode?: boolean;
  onSearch?: () => void;
  onToggleTheme?: () => void;
  actions?: ReactNode;
};

function routeHref(path: string): string {
  return path === "/" ? "/" : path.replace(/\/$/, "");
}

export function FolioHeader({
  config,
  navigation = config.navigation ?? [],
  currentDoc,
  searchEnabled = true,
  themeEnabled = true,
  shareEnabled = true,
  darkMode = false,
  onSearch,
  onToggleTheme,
  actions,
}: FolioHeaderProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const openSearch = () => {
    setMobileOpen(false);
    onSearch?.();
  };

  const isActive = (item: FolioNavigationItem) => {
    const target = routeHref(item.href);
    return (
      location.pathname === target ||
      (target !== "/" && location.pathname.startsWith(target + "/"))
    );
  };

  return (
    <header className="folio-header">
      <div className="folio-header__wrap">
        <Link to="/" className="folio-brand">
          {config.logo ? <img src={config.logo} alt="" /> : null}
          <span>{config.title}</span>
        </Link>

        <nav className="folio-desktop-nav" aria-label="主导航">
          {navigation.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                className={active ? "active" : ""}
                aria-current={active ? "page" : undefined}
                to={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="folio-header-actions">
          {shareEnabled && currentDoc ? (
            <div className="folio-mobile-doc-share">
              <FolioShareButton
                title={currentDoc.title}
                text={currentDoc.description}
                className="folio-icon-button folio-mobile-share-button"
                compact
              />
            </div>
          ) : null}

          <button
            type="button"
            className="folio-mobile-menu-button"
            aria-label={mobileOpen ? "关闭导航" : "打开导航"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
          >
            <MenuIcon open={mobileOpen} />
          </button>

          {themeEnabled && onToggleTheme ? (
            <button
              type="button"
              className="folio-icon-button folio-theme-toggle"
              onClick={onToggleTheme}
              aria-label={darkMode ? "切换到浅色模式" : "切换到暗色模式"}
              title={darkMode ? "浅色模式" : "暗色模式"}
            >
              <ThemeIcon dark={darkMode} />
            </button>
          ) : null}

          {searchEnabled && onSearch ? (
            <button
              type="button"
              className="folio-search-trigger"
              onClick={openSearch}
            >
              <SearchIcon />
              <span>搜索</span>
              <kbd>⌘K</kbd>
            </button>
          ) : null}

          {config.github ? (
            <a
              className="folio-icon-button folio-github-link"
              href={config.github}
              aria-label="GitHub"
              title="GitHub"
            >
              <GithubIcon />
            </a>
          ) : null}

          {actions ? <div className="folio-consumer-header-actions">{actions}</div> : null}
        </div>
      </div>

      {mobileOpen ? (
        <div className="folio-mobile-panel">
          <nav aria-label="移动端主导航">
            {navigation.map((item) => (
              <Link
                key={item.href}
                className={isActive(item) ? "active" : ""}
                to={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div>
            {searchEnabled && onSearch ? (
              <button type="button" onClick={openSearch}>搜索</button>
            ) : null}
            {themeEnabled && onToggleTheme ? (
              <button type="button" onClick={onToggleTheme}>
                {darkMode ? "浅色模式" : "暗色模式"}
              </button>
            ) : null}
            {config.github ? (
              <a href={config.github}>GitHub ↗</a>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
