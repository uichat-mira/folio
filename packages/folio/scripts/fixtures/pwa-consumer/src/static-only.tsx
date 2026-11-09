import { createRoot } from "react-dom/client";
import "@uichat-mira/folio/styles.css";
import { useFolioPwaUpdate, FolioPwaUpdatePrompt } from "@uichat-mira/folio/pwa/react";

// Static-publication entry: this variant deliberately does not import
// `virtual:folio/content`, so the Markdown never enters the client bundle. It is
// the realistic shape for a multi-page Folio publication (prerendered HTML plus
// a small hydration shell) and the only shape in which a Markdown-only edit
// leaves every JS/CSS asset byte-identical — the condition the content-version
// check needs to prove.
function Shell() {
  const { checkForUpdate } = useFolioPwaUpdate({
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
    <aside data-pwa-shell="">
      <FolioPwaUpdatePrompt />
    </aside>
  );
}

const container = document.getElementById("root");
if (!container) throw new Error("fixture index.html is missing #root");

// The prerendered article stays in the HTML; hydration only mounts the shell, so
// a content-only rebuild cannot change this bundle.
const shell = document.createElement("div");
document.body.append(shell);
createRoot(shell).render(<Shell />);

// Build-time marker the tarball check rewrites to prove that a JS change rotates
// the hashed bundle. It is a real runtime assignment, not a comment: production
// minification strips comments, which would make the "JS changed" build produce
// byte-identical assets and silently weaken that check.
(window as unknown as { __folioPwaAssetMarker?: string }).__folioPwaAssetMarker =
  "FOLIO_PWA_ASSET_MARKER";
