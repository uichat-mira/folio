import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { FolioPwaUpdatePrompt, useFolioPwaUpdate } from "@uichat-mira/folio/pwa/react";
import "@uichat-mira/folio/styles.css";

// FOL-039 PWA update-prompt consumer fixture.
//
// Public entries only: `@uichat-mira/folio/pwa/react` and
// `@uichat-mira/folio/styles.css`. No workspace alias, no repository source
// path, no `file:` dependency on Folio.
//
// One deliberate shape decision: the Markdown body is read from the
// **pre-rendered HTML** that `folio()` (with `staticRoutes: true`) writes into
// `#root`; the fixture never imports `virtual:folio/content`. Importing the
// content module would put the Markdown into the JS bundle, so a Markdown-only
// publication would also change `assets/*.js` -- destroying the content-only
// condition this acceptance has to prove. Keeping the body in HTML keeps every
// JS/CSS asset byte-identical between the two deployments.
const bootId = crypto.randomUUID();

function currentMarkdownText(): string {
  const article = document.querySelector("#root .folio-markdown");
  return article ? (article.textContent ?? "").replace(/\s+/g, " ").trim() : "";
}

function AcceptanceHarness() {
  // Dismissing hides the prompt for the mounted instance (upstream clears its
  // needRefresh state). A real reader gets a later app session; the fixture
  // simulates that by remounting the *unchanged* public component, so the
  // still-waiting worker is reported again by Folio's real code path.
  const [promptGeneration, setPromptGeneration] = useState(0);
  const [markdownText, setMarkdownText] = useState(currentMarkdownText);

  const update = useFolioPwaUpdate({
    onRegisteredSW: (_swScriptUrl, registration) => {
      window.__folioPwaRegistered = Boolean(registration);
    },
    onRegisterError: (error) => {
      // Registration failure must be observable and must not stop the site.
      window.__folioPwaRegisterError = error instanceof Error ? error.message : String(error);
    },
  });

  useEffect(() => {
    window.__folioPwaCheck = () => update.checkForUpdate();
    window.__folioPwaMounted = true;
    window.__folioBootId = bootId;
    setMarkdownText(currentMarkdownText());
  }, [update.checkForUpdate]);

  // P3 observability: the registration state is read from the *public* hook, so
  // the browser check proves the state a consumer actually receives rather than
  // a value the harness inferred from navigator.serviceWorker.
  useEffect(() => {
    window.__folioPwaRegistrationState = update.registrationState;
    window.__folioPwaSupported = update.supported;
    window.__folioPwaRegisteredFlag = update.registered;
  }, [update.registrationState, update.supported, update.registered]);

  return (
    <>
      <div data-content-marker="">{markdownText}</div>
      <div data-folio-pwa-harness-controls="" style={{ position: "fixed", insetBlockStart: "8px", insetInlineStart: "8px", zIndex: 2147483001 }}>
        <button
          type="button"
          data-folio-pwa-show-prompt=""
          onClick={() => setPromptGeneration((generation) => generation + 1)}
        >
          再次显示更新提示
        </button>
      </div>
      <FolioPwaUpdatePrompt key={promptGeneration} />
    </>
  );
}

const container = document.getElementById("pwa-app");
if (!container) throw new Error("consumer index.html is missing #pwa-app");
createRoot(container).render(<AcceptanceHarness />);
