import { useHref, Link } from "react-router-dom";
import type { ReactNode } from "react";
import type { FolioConfig, FolioFooterLink } from "../../types";

export type FolioFooterProps = {
  /** Uses the legacy string, a structured config, or false to hide the footer. */
  footer?: FolioConfig["footer"];
  /** Used when structured branding does not explicitly name the site. */
  siteTitle?: string;
};

function FooterAnchor({
  href,
  newTab,
  className,
  children,
}: {
  href: string;
  newTab?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const options = {
    className,
    target: newTab ? "_blank" : undefined,
    rel: newTab ? "noopener noreferrer" : undefined,
  };
  if (href.startsWith("/") && !href.startsWith("//")) {
    return <Link to={href} {...options}>{children}</Link>;
  }
  return <a href={href} {...options}>{children}</a>;
}

function FooterNavLink({ link }: { link: FolioFooterLink }) {
  return <FooterAnchor href={link.href} newTab={link.newTab}>{link.label}</FooterAnchor>;
}

function logoHref(src: string, rootHref: string): string {
  // A root-relative consumer asset must work for root and subpath deployments.
  // Other URLs are consumer-owned.
  return src.startsWith("/") && !src.startsWith("//")
    ? rootHref.replace(/\/?$/, "/") + src.slice(1)
    : src;
}

/**
 * The site-wide footer. Legacy text keeps its original markup and CSS;
 * structured mode adds common portal needs without importing site branding.
 * Full custom markup belongs to slots.footer in FolioApp.
 */
export function FolioFooter({ footer, siteTitle }: FolioFooterProps) {
  const rootHref = useHref("/");
  if (footer === false) return null;

  if (footer === undefined || typeof footer === "string") {
    return (
      <footer className="folio-footer">
        {footer ?? "Built with Folio."}
      </footer>
    );
  }

  const { brand, groups = [], legal } = footer;
  const name = brand?.name ?? siteTitle ?? "Folio";
  const hasBrand = brand !== undefined;
  const hasLegal = Boolean(
    legal && (legal.copyright !== undefined || legal.registrations?.length || legal.links?.length),
  );

  return (
    <footer className="folio-footer folio-footer--structured">
      <div className="folio-footer__inner">
        {(hasBrand || groups.length > 0) ? (
          <div className="folio-footer__main">
            {hasBrand ? (
              <div className="folio-footer__identity">
                <FooterAnchor href={brand.href ?? "/"} className="folio-footer__brand">
                  {brand.logo ? (
                    <>
                      <img
                        src={logoHref(brand.logo.src, rootHref)}
                        alt={brand.logo.alt ?? name}
                        className={
                          "folio-footer__logo" +
                          (brand.logo.darkSrc ? " folio-footer__logo--light" : "")
                        }
                        loading="lazy"
                      />
                      {brand.logo.darkSrc ? (
                        <img
                          src={logoHref(brand.logo.darkSrc, rootHref)}
                          alt={brand.logo.alt ?? name}
                          className="folio-footer__logo folio-footer__logo--dark"
                          loading="lazy"
                        />
                      ) : null}
                    </>
                  ) : <span className="folio-footer__brand-text">{name}</span>}
                </FooterAnchor>
                {brand.description ? (
                  <p className="folio-footer__description">{brand.description}</p>
                ) : null}
              </div>
            ) : null}
            {groups.length > 0 ? (
              <nav className="folio-footer__groups" aria-label="页脚导航">
                {groups.map((group, index) => (
                  <section className="folio-footer__group" key={index}>
                    <h2>{group.title}</h2>
                    <ul>
                      {group.links.map((link, linkIndex) => (
                        <li key={linkIndex}><FooterNavLink link={link} /></li>
                      ))}
                    </ul>
                  </section>
                ))}
              </nav>
            ) : null}
          </div>
        ) : null}
        {hasLegal ? (
          <div className="folio-footer__legal">
            {legal!.copyright !== undefined ? (
              <span className="folio-footer__copyright">{legal!.copyright}</span>
            ) : null}
            {legal!.registrations?.length ? (
              <div className="folio-footer__registrations">
                {legal!.registrations.map((link, index) => <FooterNavLink key={index} link={link} />)}
              </div>
            ) : null}
            {legal!.links?.length ? (
              <div className="folio-footer__legal-links">
                {legal!.links.map((link, index) => <FooterNavLink key={index} link={link} />)}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </footer>
  );
}
