import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { folio } from "@uichat-mira/folio/vite";

// FOL-019 consumer: same three public entrypoints as FOL-014 —
// `@uichat-mira/folio/vite` (this file), `@uichat-mira/folio` + `styles.css`
// + `virtual:folio/content` (src/main.tsx). No repository source path, no
// workspace alias, no official-site stylesheet.
//
// One fixture, two builds, selected by an environment variable so both output
// paths are produced from the same tarball and the same content:
//
//   FOLIO019_STATIC unset  -> staticRoutes: false (React SPA shell; the
//                             browser acceptance drives the real runtime)
//   FOLIO019_STATIC=1      -> staticRoutes: {}   (pre-rendered HTML written by
//                             the package's public Vite plugin; the no-JS
//                             reading path is measured on that output)
export default defineConfig({
  plugins: [
    react(),
    folio({
      contentDir: "content",
      staticRoutes: process.env.FOLIO019_STATIC === "1" ? {} : false,
      config: {
        title: "Folio 默认文档站消费者基线",
        description:
          "只安装真实 tarball 的独立 Vite + React 消费者，用于采集 Folio 默认文档 UI 基线。",
        navigation: [{ label: "文档", href: "/docs" }],
        footer: "FOL-019 · 独立消费者默认 UI 基线",
      },
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
