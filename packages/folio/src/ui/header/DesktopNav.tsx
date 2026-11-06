import { Link } from "react-router-dom";
import { ChevronDownIcon, NavIcon } from "../../icons";
import {
  isFolioNavItemActive,
  type FolioNavMenuItem,
  type FolioResolvedNavItem,
} from "../../core/navigation";

type DesktopNavProps = {
  items: FolioResolvedNavItem[];
  pathname: string;
  openMenu: string | null;
  setOpenMenu: (value: string | null) => void;
  panelId: (label: string) => string;
  cancelScheduledClose: () => void;
  closeMenu: () => void;
};

/** Header-internal desktop navigation. Disclosure state remains owned by Header. */
export function DesktopNav({
  items,
  pathname,
  openMenu,
  setOpenMenu,
  panelId,
  cancelScheduledClose,
  closeMenu,
}: DesktopNavProps) {
  function renderTrigger(item: FolioNavMenuItem) {
    const active = isFolioNavItemActive(item, pathname);
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
    // The section root belongs to the panel heading on desktop, not to a
    // synthetic full-width card. Keep the resolved entry for mobile consumers.
    const groups = item.groups
      .map((group) => ({
        ...group,
        entries: group.entries.filter((entry) => entry.href !== item.href),
      }))
      .filter((group) => group.entries.length > 0);
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
          <Link to={item.href} onClick={closeMenu}>
            {item.panel.title}
          </Link>
          {item.panel.description ? <p>{item.panel.description}</p> : null}
        </div>
        <div className="folio-nav-menu__entries">
          {groups.map((group) => (
            <div
              className="folio-nav-menu__group"
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
    const active = isFolioNavItemActive(item, pathname);

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
    <nav className="folio-desktop-nav" aria-label="主导航">
      <ul className="folio-desktop-nav__list">
        {items.map(renderDesktopItem)}
      </ul>
    </nav>
  );
}
