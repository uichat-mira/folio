import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { folio } from "@uichat-mira/folio/vite";
import { folioPwa } from "@uichat-mira/folio/pwa";

// FOL-039 fixture: the smallest realistic consumer of the optional PWA
// integration. Every input that differs between checks is an environment
// override instead of a second config file, matching the existing
// vite-consumer fixture convention:
//
//   FOLIO_PWA_BASE          deployment base ("/" or "/folio-smoke/")
//   FOLIO_PWA_OUT_DIR       output directory
//   FOLIO_PWA_VERSION_FILE  content version file name (default folio-version.json)
//   FOLIO_PWA_UPDATE_MODE   "prompt" (default) or "auto"
//   FOLIO_PWA_DISABLED      "on" builds without PWA output
//   FOLIO_PWA_SITE_URL      optional absolute site URL for canonical/sitemap
const base = process.env.FOLIO_PWA_BASE ?? "/";
const outDir = process.env.FOLIO_PWA_OUT_DIR ?? "dist";
const versionFile = process.env.FOLIO_PWA_VERSION_FILE;
const updateMode = process.env.FOLIO_PWA_UPDATE_MODE === "auto" ? "auto" : "prompt";
const disabled = process.env.FOLIO_PWA_DISABLED === "on";
const siteUrl = process.env.FOLIO_PWA_SITE_URL;
// FOLIO_PWA_STATIC_ONLY=on swaps the client entry for one that does not import
// `virtual:folio/content`. That keeps Markdown out of the JS bundle, which is the
// only way a content-only edit can leave every asset byte-identical.
const staticOnly = process.env.FOLIO_PWA_STATIC_ONLY === "on";
// FOLIO_PWA_INJECT_PAGE=<url> adds one precache entry through Workbox'
// `manifestTransforms`, the escape hatch Folio cannot inspect at config time.
// The check uses it to prove the emitted-manifest guard really rejects a page
// entry from a *published* tarball, not just from the workspace build.
const injectPage = process.env.FOLIO_PWA_INJECT_PAGE;

const config = {
  title: "Folio PWA consumer fixture",
  description: "Standalone Vite + React consumer of the optional Folio PWA integration.",
  ...(siteUrl ? { siteUrl } : {}),
  collections: [{ path: "/blogs", title: "博客" }],
};

export default defineConfig({
  base,
  plugins: [
    staticOnly
      ? {
          name: "folio-pwa-fixture-static-only-entry",
          transformIndexHtml: {
            order: "pre" as const,
            handler(html: string) {
              return html.replace("/src/main.tsx", "/src/static-only.tsx");
            },
          },
        }
      : undefined,
    react(),
    folio({
      contentDir: process.env.FOLIO_PWA_CONTENT_DIR ?? "content",
      config,
      staticRoutes: true,
    }),
    folioPwa({
      config,
      icons: [
        { src: "pwa-icon-192.png", sizes: "192x192" },
        { src: "pwa-icon-512.png", sizes: "512x512" },
        { src: "pwa-maskable-512.png", sizes: "512x512", purpose: "maskable" },
      ],
      themeColor: "#cc785c",
      backgroundColor: "#faf9f5",
      lang: "zh-CN",
      updateMode,
      disable: disabled,
      ...(versionFile ? { versionFile } : {}),
      ...(injectPage
        ? {
            workbox: {
              manifestTransforms: [
                (entries: { url: string; revision: string | null }[]) => ({
                  manifest: [...entries, { url: injectPage, revision: "injected" }],
                  warnings: [],
                }),
              ],
            },
          }
        : {}),
    }),
  ],
  build: { outDir, emptyOutDir: true },
});
