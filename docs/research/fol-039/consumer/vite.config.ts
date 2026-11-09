import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { folio } from "@uichat-mira/folio/vite";
import { folioPwa } from "@uichat-mira/folio/pwa";

// FOL-039 consumer: a real tarball consumer that opts into the optional PWA
// integration. Only public entries are used — `@uichat-mira/folio/vite`,
// `@uichat-mira/folio/pwa` and (in src/main.tsx) `@uichat-mira/folio/pwa/react`
// plus `@uichat-mira/folio/styles.css`. No workspace alias, no repository
// source path, no file dependency.
//
// `staticRoutes` is on so every document is a real generated HTML page: the
// update-under-test is a Markdown/HTML-only publication, and the browser must
// read the new body from the network instead of a precached page.
const config = {
  title: "Folio PWA 更新验收",
  description: "只安装真实 tarball 的独立消费者，用于验收 Folio 可选 PWA 更新提示。",
  navigation: [{ label: "文档", href: "/docs" }],
  footer: "FOL-039 · PWA prompt acceptance",
};

export default defineConfig({
  plugins: [
    react(),
    folio({
      contentDir: "content",
      staticRoutes: true,
      config,
    }),
    folioPwa({
      config,
      // The default is "prompt"; it is stated explicitly so a future default
      // change cannot silently turn this acceptance into an auto-update test.
      updateMode: "prompt",
      icons: [
        { src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
        { src: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
      ],
      includeAssets: ["icons/icon-192.svg", "icons/icon-512.svg"],
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
