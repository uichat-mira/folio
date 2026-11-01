import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { folio } from "@uichat-mira/folio/vite";

// One fixture serves several checks, so every input that differs between them
// is an explicit override instead of a second config file: the content
// directory and output directory (bundle check and its no-Markdown control),
// plus the deployment base, site URL and static-generation switch (static
// output check and its staticRoutes-off control).
const contentDir = process.env.FOLIO_CONSUMER_CONTENT_DIR ?? "content";
const outDir = process.env.FOLIO_CONSUMER_OUT_DIR ?? "dist";
const base = process.env.FOLIO_CONSUMER_BASE ?? "/";
const siteUrl = process.env.FOLIO_CONSUMER_SITE_URL;
const staticRoutes = process.env.FOLIO_CONSUMER_STATIC === "on";

export default defineConfig({
  base,
  plugins: [
    react(),
    folio({
      contentDir,
      config: {
        title: "Folio Vite consumer fixture",
        description:
          "Standalone Vite + React consumer of the published Folio package.",
        ...(siteUrl ? { siteUrl } : {}),
        collections: [
          { path: "/blogs", title: "博客" },
          { path: "/projects", title: "项目" },
        ],
      },
      // Static HTML generation stays off by default so the client-bundle
      // checks keep their original build shape; the static-output check turns
      // it on to prove writeBundle produces the real site files.
      staticRoutes,
    }),
  ],
  build: {
    outDir,
    emptyOutDir: true,
  },
});
