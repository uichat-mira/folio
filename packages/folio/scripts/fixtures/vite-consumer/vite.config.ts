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
const homeMode = process.env.FOLIO_CONSUMER_HOME_MODE ?? "default";

const config = {
  title: "Folio Vite consumer fixture",
  description:
    "Standalone Vite + React consumer of the published Folio package.",
  ...(siteUrl ? { siteUrl } : {}),
  collections: [
    { path: "/blogs", title: "博客" },
    { path: "/projects", title: "项目" },
  ],
  ...(homeMode === "configured"
    ? {
        home: {
          meta: { left: "CONFIGURED HOME", right: "TARBALL" },
          sections: [
            { type: "intro" as const, title: "Configured consumer home" },
            { type: "featured" as const, collection: "/docs", label: "Consumed" },
            { type: "recent" as const, collection: "/docs", limit: 2 },
            { type: "collections" as const, paths: ["/blogs", "/projects"] },
          ],
        },
      }
    : {}),
};

const staticOptions =
  homeMode === "override"
    ? {
        home: () => ({
          title: "Advanced static home",
          description: "Explicit static-only home override.",
          body:
            '<main class="folio-static-home-override">' +
            "<h1>Advanced static home</h1>" +
            '<a href="' + base + 'docs/hello/">Open fixture document</a>' +
            "</main>",
        }),
      }
    : true;

export default defineConfig({
  base,
  plugins: [
    react(),
    folio({
      contentDir,
      config,
      // Static HTML generation stays off by default so the client-bundle
      // checks keep their original build shape; the static-output check turns
      // it on to prove writeBundle produces the real site files.
      staticRoutes: staticRoutes ? staticOptions : false,
    }),
  ],
  build: {
    outDir,
    emptyOutDir: true,
  },
});
