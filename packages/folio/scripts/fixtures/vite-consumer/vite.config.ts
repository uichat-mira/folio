import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { folio } from "@uichat-mira/folio/vite";

// The content directory and output directory are overridable so the same
// fixture can run a negative control build without any discovered markdown.
const contentDir = process.env.FOLIO_CONSUMER_CONTENT_DIR ?? "content";
const outDir = process.env.FOLIO_CONSUMER_OUT_DIR ?? "dist";

export default defineConfig({
  plugins: [
    react(),
    folio({
      contentDir,
      config: {
        title: "Folio Vite consumer fixture",
        description:
          "Standalone Vite + React consumer of the published Folio package.",
      },
      // Static HTML generation is verified by another task; this fixture only
      // proves content discovery and the client bundle.
      staticRoutes: false,
    }),
  ],
  build: {
    outDir,
    emptyOutDir: true,
  },
});
