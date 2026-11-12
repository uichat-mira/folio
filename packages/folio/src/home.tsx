import { Link } from "react-router-dom";
import { resolveFolioHome, type FolioHomeModel, type FolioHomeSection } from "./core/home";
import { FolioEntryList } from "./ui/entry-list";
import type { FolioConfig, FolioDoc, FolioHomeTemplate } from "./types";

function href(path: string): string {
  return path === "/" ? "/" : path.replace(/\/$/, "");
}

function PortalHome({ model, as: Root }: { model: FolioHomeModel; as: "main" | "div" }) {
  return (
    <Root className="folio-home folio-home--portal">
      {model.meta && (
        <div className="folio-portal-meta" aria-label="站点首页">
          {model.meta.left ? <span>{model.meta.left}</span> : null}
          {model.meta.right ? <span>{model.meta.right}</span> : null}
        </div>
      )}
      {model.sections.map((section, index) => {
        switch (section.type) {
          case "intro":
            return (
              <section className="folio-portal-hero" key={"intro-" + index}>
                {section.kicker ? <p className="folio-portal-kicker">{section.kicker}</p> : null}
                <h1>{section.title}</h1>
                <p className="folio-portal-description">{section.description}</p>
                {section.collection && (
                  <Link className="folio-portal-hero-link" to={section.collection.path}>
                    浏览{section.collection.title} <span aria-hidden="true">→</span>
                  </Link>
                )}
              </section>
            );
          case "featured":
            return (
              <section className="folio-portal-featured" key={"featured-" + index}>
                <Link className="folio-portal-feature" to={href(section.doc.path)}>
                  <span className="folio-portal-feature-label">{section.label}</span>
                  <span className="folio-portal-feature-index">
                    {String(section.number).padStart(2, "0")} / {String(section.total).padStart(2, "0")}
                  </span>
                  <h2>{section.doc.title}</h2>
                  {section.doc.description && <p>{section.doc.description}</p>}
                  <span className="folio-portal-feature-link">
                    {section.readLabel} <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </section>
            );
          case "recent":
            return (
              <section
                className="folio-portal-section folio-portal-recent"
                aria-label={section.title}
                key={"recent-" + index}
              >
                <div className="folio-portal-section-heading">
                  <div>
                    <span className="folio-portal-section-label">{section.label}</span>
                    <h2>{section.title}</h2>
                  </div>
                  {section.collection && (
                    <Link to={section.collection.path} className="folio-portal-view-all">
                      全部{section.collection.title} <span aria-hidden="true">→</span>
                    </Link>
                  )}
                </div>
                {section.docs.length ? (
                  <FolioEntryList entries={section.docs} headingLevel="h3" />
                ) : section.hadEntries ? (
                  <p className="folio-portal-endnote">{section.endMessage}</p>
                ) : (
                  <p className="folio-collection-empty">{section.emptyMessage}</p>
                )}
              </section>
            );
          case "collections":
            return (
              <section className="folio-portal-section folio-portal-collections" key={"collections-" + index}>
                <div className="folio-portal-collection-grid">
                  {section.collections.map((entry) => (
                    <section className="folio-portal-collection" key={entry.collection.path}>
                      <div className="folio-portal-section-heading">
                        <div>
                          <h2>{entry.collection.title}</h2>
                          {entry.collection.description ? (
                            <p className="folio-portal-collection-description">
                              {entry.collection.description}
                            </p>
                          ) : null}
                        </div>
                        <Link
                          to={entry.collection.path}
                          className="folio-portal-view-all"
                          aria-label={"全部" + entry.collection.title}
                        >
                          全部 <span aria-hidden="true">→</span>
                        </Link>
                      </div>
                      {entry.docs.length ? (
                        <FolioEntryList entries={entry.docs} headingLevel="h3" />
                      ) : (
                        <p className="folio-collection-empty">{entry.emptyMessage}</p>
                      )}
                    </section>
                  ))}
                </div>
              </section>
            );
          case "about":
            return (
              <section className="folio-portal-section folio-portal-about-section" key={"about-" + index}>
                <aside className="folio-portal-about">
                  <h2>{section.title}</h2>
                  <p>{section.description}</p>
                  <Link to={href(section.doc.path)}>
                    {section.linkLabel} <span aria-hidden="true">→</span>
                  </Link>
                </aside>
              </section>
            );
        }
      })}
    </Root>
  );
}

function EditorialHome({ model, as: Root }: { model: FolioHomeModel; as: "main" | "div" }) {
  function renderSection(section: FolioHomeSection, index: number) {
    switch (section.type) {
      case "intro":
        return (
          <section className="folio-editorial-lead folio-editorial-lead--single" key={"intro-" + index}>
            <div className="folio-editorial-intro">
              <div className="folio-editorial-kicker">
                <span className="folio-editorial-kicker-line" aria-hidden="true" />
                {section.kicker}
              </div>
              <h1>{section.title}</h1>
              <p>{section.description}</p>
              {section.collection && (
                <Link className="folio-editorial-hero-link" to={section.collection.path}>
                  浏览{section.collection.title} <span aria-hidden="true">↗</span>
                </Link>
              )}
            </div>
          </section>
        );
      case "featured":
        return (
          <section className="folio-editorial-lead folio-editorial-lead--single" key={"featured-" + index}>
            <Link className="folio-editorial-feature" to={href(section.doc.path)}>
              <span className="folio-editorial-feature-label">
                <span aria-hidden="true">✳</span> {section.label}
              </span>
              <span className="folio-editorial-feature-body">
                <span className="folio-editorial-feature-no">
                  {String(section.number).padStart(2, "0")} / {String(section.total).padStart(2, "0")}
                </span>
                <h2>{section.doc.title}</h2>
                {section.doc.description && <p>{section.doc.description}</p>}
              </span>
              <span className="folio-editorial-feature-bottom">
                {section.readLabel} <span aria-hidden="true">↗</span>
              </span>
            </Link>
          </section>
        );
      case "recent":
        return (
          <section className="folio-editorial-lower folio-editorial-lower--single" key={"recent-" + index}>
            <section className="folio-editorial-recent" aria-label="文章选读">
              <div className="folio-editorial-section-heading">
                <div>
                  <span className="folio-editorial-section-label">{section.label}</span>
                  <h2>{section.title}</h2>
                </div>
                {section.collection && (
                  <Link to={section.collection.path} className="folio-editorial-view-all">
                    全部{section.collection.title} <span aria-hidden="true">↗</span>
                  </Link>
                )}
              </div>
              {section.docs.length ? (
                <FolioEntryList entries={section.docs} headingLevel="h3" />
              ) : section.hadEntries ? (
                <p className="folio-editorial-endnote">{section.endMessage}</p>
              ) : (
                <p className="folio-collection-empty">{section.emptyMessage}</p>
              )}
            </section>
          </section>
        );
      case "collections":
        return (
          <section className="folio-editorial-lower folio-editorial-lower--single" key={"collections-" + index}>
            <div className="folio-editorial-aside">
              {section.collections.map((entry, entryIndex) => (
                <section className="folio-editorial-side-section" key={entry.collection.path}>
                  <div className="folio-editorial-section-heading">
                    <div>
                      <span className="folio-editorial-section-label">
                        {String(entryIndex + 2).padStart(2, "0")} / COLLECTION
                      </span>
                      <h2>{entry.collection.title}</h2>
                    </div>
                    <Link
                      to={entry.collection.path}
                      className="folio-editorial-view-all"
                      aria-label={"全部" + entry.collection.title}
                    >
                      ↗
                    </Link>
                  </div>
                  {entry.docs.length ? (
                    <FolioEntryList entries={entry.docs} headingLevel="h3" />
                  ) : (
                    <p className="folio-collection-empty">{entry.emptyMessage}</p>
                  )}
                </section>
              ))}
            </div>
          </section>
        );
      case "about":
        return (
          <section className="folio-editorial-lower folio-editorial-lower--single" key={"about-" + index}>
            <aside className="folio-editorial-about">
              <span className="folio-editorial-section-label">A LITTLE ABOUT</span>
              <h2>{section.title}</h2>
              <p>{section.description}</p>
              <Link to={href(section.doc.path)}>
                {section.linkLabel} <span aria-hidden="true">↗</span>
              </Link>
            </aside>
          </section>
        );
    }
  }

  return (
    <Root className="folio-home folio-journal-home folio-editorial-home">
      {model.meta && (
        <div className="folio-editorial-meta" aria-label="站点首页">
          <span>{model.meta.left}</span>
          <span>{model.meta.right}</span>
        </div>
      )}
      {model.sections.map(renderSection)}
    </Root>
  );
}


/**
 * Render a real built-in Folio home outside the default "/" route.
 *
 * Must be used within a React Router (FolioApp supplies one). Its basename
 * owns the deployment base path. Use as="div" inside an existing <main> so
 * a preview does not create a second main landmark.
 */
export type FolioHomeProps = {
  config: FolioConfig;
  docs: readonly FolioDoc[];
  template?: FolioHomeTemplate;
  as?: "main" | "div";
};

export function FolioHome({ config, docs, template, as = "main" }: FolioHomeProps) {
  const selected = template === undefined
    ? config
    : { ...config, home: { ...config.home, template } };
  const model = resolveFolioHome(selected, docs);
  return model.template === "editorial"
    ? <EditorialHome model={model} as={as} />
    : <PortalHome model={model} as={as} />;
}
