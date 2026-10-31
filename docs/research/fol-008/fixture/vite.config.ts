import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { folio } from "@uichat-mira/folio/vite";

// FOL-008 只观察真实静态生成与真实 React 渲染，不覆盖 routes：这样静态 HTML
// 来自库默认的 staticRoutes（含文档导航、TOC、分页），而不是站点自有模板。
const base = process.env.FOLIO_FIXTURE_BASE ?? "/";
const outDir = process.env.FOLIO_FIXTURE_OUT ?? "dist";

export default defineConfig({
  base,
  plugins: [
    react(),
    folio({
      contentDir: "content",
      config: {
        title: "FOL-008 Navigation Fixture",
        description: "Static vs React navigation parity corpus.",
      },
      staticRoutes: true,
    }),
  ],
  build: {
    outDir,
    emptyOutDir: true,
  },
});
