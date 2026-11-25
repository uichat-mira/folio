import { createRoot } from "react-dom/client";
import "@uichat-mira/folio/styles.css";
import { defineFolioConfig } from "@uichat-mira/folio";
import { useFolioPwaUpdate, FolioPwaUpdatePrompt } from "@uichat-mira/folio/pwa/react";
import docs, { roots } from "virtual:folio/content";

// The fixture proves the documented consumer shape: mount the default prompt and
// use the hook only when the application needs its own UI. `window.__folioPwa`
// exposes the official update trigger so a browser harness can ask for an update
// check deterministically instead of waiting for the throttle window.
const config = defineFolioConfig({
  title: "Folio PWA consumer fixture",
  description: "Standalone consumer of the optional Folio PWA integration.",
});

function UpdateControls() {
  const { checkForUpdate, needRefresh } = useFolioPwaUpdate({
    onRegisterError: (error) => {
      (window as unknown as { __folioPwaRegisterError?: string }).__folioPwaRegisterError =
        error instanceof Error ? error.message : String(error);
    },
    onRegisteredSW: () => {
      (window as unknown as { __folioPwaRegistered?: boolean }).__folioPwaRegistered = true;
    },
  });
  (window as unknown as { __folioPwaCheck?: () => Promise<void> }).__folioPwaCheck =
    checkForUpdate;
  return (
    <p data-pwa-state={needRefresh ? "need-refresh" : "current"}>
      pwa need-refresh={String(needRefresh)}
    </p>
  );
}

const container = document.getElementById("root");
if (!container) throw new Error("fixture index.html is missing #root");

createRoot(container).render(
  <main>
    <h1>{config.title}</h1>
    <p data-doc-count={docs.length}>{`docs=${docs.length} roots=${roots.join(",")}`}</p>
    {docs.map((doc) => (
      <article key={doc.path} data-doc-path={doc.path}>
        <h2>{doc.title}</h2>
        {/* The static build carries the same Markdown; the harness compares the
            generated HTML, so the body text must be observable in the DOM too. */}
        <pre data-doc-body>{doc.body}</pre>
      </article>
    ))}
    <UpdateControls />
    <FolioPwaUpdatePrompt />
  </main>,
);
