import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { FolioShareButton } from "./share";
import {
  ChevronDownIcon,
  GithubIcon,
  MenuIcon,
  NavIcon,
  SearchIcon,
  ThemeIcon,
} from "./icons";
import {
  isFolioNavItemActive,
  resolveFolioNavigation,
  type FolioNavMenuItem,
  type FolioResolvedNavItem,
} from "./core/navigation";
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

// A short close delay keeps a diagonal pointer path from the trigger into the
// panel from flashing the menu shut. The panel also covers the gap with a
// transparent bridge in CSS, so this is a safety net, not the only guard.
const MENU_CLOSE_DELAY = 140;

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
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const idBase = useId();

  const items = useMemo(() => resolveFolioNavigation(navigation), [navigation]);

  const cancelScheduledClose = useCallback(() => {
    if (closeTimer.current === undefined) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = undefined;
  }, []);

  const closeMenu = useCallback(() => {
    cancelScheduledClose();
    setOpenMenu(null);
  }, [cancelScheduledClose]);

  useEffect(() => () => cancelScheduledClose(), [cancelScheduledClose]);

  // Escape and outside-pointer dismissal are owned by the header itself rather
  // than a backdrop, so the panel never traps clicks meant for the page.
  useEffect(() => {
    if (openMenu === null && !mobileOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      // The mobile panel is a sibling of the nav cluster (it is fixed to the
      // viewport, not nested in the header rail), so both containers have to
      // count as "inside" or the first tap in the panel closes it.
      const target = event.target as Node;
      if (navRef.current?.contains(target)) return;
      if (mobilePanelRef.current?.contains(target)) return;
      cancelScheduledClose();
      setOpenMenu(null);
      setMobileOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      cancelScheduledClose();
      setOpenMenu(null);
      setMobileOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu, mobileOpen, cancelScheduledClose]);

  // A route change means the reader navigated: any open surface is stale.
  useEffect(() => {
    cancelScheduledClose();
    setMobileOpen(false);
    setOpenMenu(null);
    setMobileGroup(null);
  }, [location.pathname, cancelScheduledClose]);

  const openSearch = () => {
    setMobileOpen(false);
    setOpenMenu(null);
    onSearch?.();
  };

  const panelId = (label: string) =>
    `${idBase}-menu-${label.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
  const mobilePanelId = `${idBase}-mobile`;

  function renderTrigger(item: FolioNavMenuItem) {
    const active = isFolioNavItemActive(item, location.pathname);
    const expanded = openMenu === item.label;
    return (
      <Link
        to={item.href}
        className={
          "folio-nav-menu__trigger" +
          (active ? " active" : "") +
          (expanded ? " is-expanded" : "")
        }
        aria-expanded={expanded}
        aria-haspopup="true"
        aria-controls={expanded ? panelId(item.label) : undefined}
        aria-current={active ? "page" : undefined}
        onClick={(event) => {
          // Modified clicks keep normal link behavior (new tab, save, download);
          // a plain click belongs to the disclosure.
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
          }
          event.preventDefault();
          cancelScheduledClose();
          setOpenMenu(expanded ? null : item.label);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          closeMenu();
        }}
      >
        <span>{item.label}</span>
        <ChevronDownIcon />
      </Link>
    );
  }

  function renderPanel(item: FolioNavMenuItem) {
    const expanded = openMenu === item.label;
    return (
      <div
        className={"folio-nav-menu__panel" + (expanded ? " is-open" : "")}
        id={panelId(item.label)}
        // A disclosure panel is a labelled group, not an ARIA menu: entries
        // stay ordinary tab stops with native link semantics.
        role="group"
        aria-label={item.panel.title}
      >
        <div className="folio-nav-menu__head">
          {item.panel.eyebrow ? (
            <span className="folio-nav-menu__eyebrow">{item.panel.eyebrow}</span>
          ) : null}
          <strong>{item.panel.title}</strong>
          {item.panel.description ? <p>{item.panel.description}</p> : null}
        </div>
        <div className="folio-nav-menu__entries">
          {item.groups.map((group) => (
            <div
              className={
                "folio-nav-menu__group" +
                (group.label ? "" : " folio-nav-menu__group--overview")
              }
              key={group.label ?? "__ungrouped"}
            >
              {group.label ? (
                <span className="folio-nav-menu__group-label">{group.label}</span>
              ) : null}
              <div className="folio-nav-menu__group-entries">
                {group.entries.map((entry) => (
                  <Link
                    className="folio-nav-menu__entry"
                    to={entry.href}
                    key={entry.href + entry.label}
                    onClick={closeMenu}
                  >
                    <span className="folio-nav-menu__icon" aria-hidden="true">
                      <NavIcon name={entry.icon} />
                    </span>
                    <span className="folio-nav-menu__copy">
                      <strong>{entry.label}</strong>
                      {entry.description ? <small>{entry.description}</small> : null}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderDesktopItem(item: FolioResolvedNavItem) {
    const active = isFolioNavItemActive(item, location.pathname);

    if (item.kind === "link") {
      return (
        <li key={item.href + item.label}>
          <Link
            className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}
            to={item.href}
          >
            {item.label}
          </Link>
        </li>
      );
    }

    return (
      <li
        className={"folio-nav-menu" + (openMenu === item.label ? " is-open" : "")}
        key={item.href + item.label}
        onPointerEnter={(event) => {
          if (event.pointerType !== "mouse") return;
          cancelScheduledClose();
          setOpenMenu(item.label);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "mouse") return;
          cancelScheduledClose();
          closeTimer.current = window.setTimeout(() => {
            closeTimer.current = undefined;
            setOpenMenu(null);
          }, MENU_CLOSE_DELAY);
        }}
        onBlur={(event) => {
          // Tabbing out of the whole item (trigger and panel) closes it; moving
          // focus into the panel keeps it open.
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
            return;
          }
          closeMenu();
        }}
      >
        {renderTrigger(item)}
        {renderPanel(item)}
      </li>
    );
  }

  return (
    <header className="folio-header">
      <div className="folio-header__wrap">
        <Link to="/" className="folio-brand">
          {config.logo ? <img src={config.logo} alt="" /> : null}
          <span>{config.title}</span>
        </Link>

        {/* Navigation and utility actions are one right-hand cluster. The nav
            is the only element that gets `margin-left: auto`, so the brand
            stays left and everything else forms a continuous right rail. */}
        <div
          className="folio-header__nav"
          ref={navRef as RefObject<HTMLDivElement>}
        >
          <nav className="folio-desktop-nav" aria-label="主导航">
            <ul className="folio-desktop-nav__list">
              {items.map(renderDesktopItem)}
            </ul>
          </nav>

          <div className="folio-header-actions">
            <button
              type="button"
              className="folio-mobile-menu-button"
              aria-label={mobileOpen ? "关闭导航" : "打开导航"}
              aria-expanded={mobileOpen}
              aria-controls={mobilePanelId}
              onClick={() => {
                setMobileOpen((value) => !value);
                setOpenMenu(null);
              }}
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
      </div>

      {/* The mobile panel stays mounted so it can animate in and out; the
          closed state is `visibility: hidden`, which also removes it from the
          tab order without unmounting the disclosure state. */}
      <div
        className={"folio-mobile-panel" + (mobileOpen ? " is-open" : "")}
        id={mobilePanelId}
        ref={mobilePanelRef}
      >
        {actions ? <div className="folio-mobile-panel__custom-actions">{actions}</div> : null}
        <nav aria-label="移动端主导航">
          {items.map((item, index) => {
            const active = isFolioNavItemActive(item, location.pathname);

            if (item.kind === "link") {
              return (
                <Link
                  key={item.href + item.label}
                  className={active ? "active" : ""}
                  aria-current={active ? "page" : undefined}
                  to={item.href}
                >
                  {item.label}
                </Link>
              );
            }

            const groupId = `${mobilePanelId}-group-${index}`;
            const groupOpen = mobileGroup === groupId;
            return (
              <div className="folio-mobile-group" key={item.href + item.label}>
                <button
                  type="button"
                  className={
                    "folio-mobile-group__trigger" + (active ? " active" : "")
                  }
                  aria-expanded={groupOpen}
                  aria-controls={groupId}
                  onClick={() =>
                    setMobileGroup((value) => (value === groupId ? null : groupId))
                  }
                >
                  <span>{item.label}</span>
                  <ChevronDownIcon />
                </button>
                <div
                  className={
                    "folio-mobile-group__panel" + (groupOpen ? " is-open" : "")
                  }
                  id={groupId}
                >
                  <div className="folio-mobile-group__inner">
                    {item.groups.map((group) => (
                      <div
                        className="folio-mobile-group__section"
                        key={group.label ?? "__ungrouped"}
                      >
                        {group.label ? (
                          <span className="folio-mobile-group__label">{group.label}</span>
                        ) : null}
                        {group.entries.map((entry) => (
                          <Link
                            key={entry.href + entry.label}
                            to={entry.href}
                            onClick={() => {
                              setMobileOpen(false);
                              setMobileGroup(null);
                            }}
                          >
                            <span>{entry.label}</span>
                            {entry.description ? <small>{entry.description}</small> : null}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
        <div className="folio-mobile-panel__actions" aria-label="页面工具">
          {searchEnabled && onSearch ? (
            <button type="button" onClick={openSearch} aria-label="搜索" title="搜索">
              <SearchIcon />
            </button>
          ) : null}
          {themeEnabled && onToggleTheme ? (
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={darkMode ? "切换到浅色模式" : "切换到暗色模式"}
              title={darkMode ? "浅色模式" : "暗色模式"}
            >
              <ThemeIcon dark={darkMode} />
            </button>
          ) : null}
          {shareEnabled && currentDoc ? (
            <FolioShareButton
              title={currentDoc.title}
              text={currentDoc.description}
              className="folio-mobile-tool-share"
              compact
            />
          ) : null}
          {config.github ? (
            <a href={config.github} aria-label="GitHub" title="GitHub">
              <GithubIcon />
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}
