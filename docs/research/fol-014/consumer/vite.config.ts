import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { folio } from "@uichat-mira/folio/vite";

// FOL-014 consumer: exactly three public entrypoints are used here —
// `@uichat-mira/folio/vite` (this file), `@uichat-mira/folio` + `styles.css`
// + `virtual:folio/content` (src/main.tsx). No repository source path, no
// workspace alias, no official-site stylesheet.
//
// `staticRoutes` is deliberately false: FOL-009 already verifies the generated
// static HTML, while this acceptance exercises the React runtime that a
// consumer gets from `vite build`. It keeps the served artifact a single SPA
// shell so a click in the browser cannot be answered by a pre-rendered page.
export default defineConfig({
  plugins: [
    react(),
    folio({
      contentDir: "content",
      staticRoutes: false,
      config: {
        title: "Folio 默认文档站消费者验收",
        description:
          "只安装真实 tarball 的独立 Vite + React 消费者，用于验收 Folio 默认文档 UI。",
        navigation: [{ label: "文档", href: "/docs" }],
        footer: "FOL-014 · 独立消费者默认 UI 验收",
      },
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
