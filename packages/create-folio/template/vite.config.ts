import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { folio } from "@uichat-mira/folio/vite";
import config from "./folio.config";

export default defineConfig({
  plugins: [react(), folio({
    contentDir: "content",
    config,
    staticRoutes: true,
  })],
});
