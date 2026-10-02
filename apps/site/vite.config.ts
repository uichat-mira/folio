import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolveGithubPagesBase } from "@uichat-mira/folio";
import { folio } from "@uichat-mira/folio/vite";
import config from "./folio.config";

const base = resolveGithubPagesBase(process.env.GITHUB_REPOSITORY);

export default defineConfig({
  base,
  plugins: [
    react(),
    folio({
      contentDir: "content",
      config,
      staticRoutes: true,
    }),
  ],
});
