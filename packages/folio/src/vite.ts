import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { relative, resolve } from "node:path";
import type { Plugin } from "vite";
import { compareFolioDocs, parseFolioDoc } from "./content";
import {
  writeFolioStaticSite,
  type FolioStaticBuildOptions,
} from "./static";
import type { FolioDoc, FolioConfig } from "./types";

const VIRTUAL_ID = "virtual:folio/content";
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;

export type FolioPluginOptions = {
  contentDir?: string;
  config: FolioConfig;
  staticRoutes?: boolean | FolioStaticBuildOptions;
  exclude?: (sourcePath: string) => boolean;
  route?: (sourcePath: string, doc: FolioDoc) => string;
};

export type FolioContentManifest = {
  docs: FolioDoc[];
  roots: string[];
};

function markdownFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.name.endsWith(".md") ? [path] : [];
  });
}

function normalizeRoute(path: string): string {
  const normalized = `/${path}`.replace(/\/{2,}/g, "/");
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

function readManifest(
  contentDir: string,
  options: FolioPluginOptions,
): FolioContentManifest {
  const docs = markdownFiles(contentDir)
    .map((file) => {
      const sourcePath = relative(contentDir, file).replace(/\\/g, "/");
      if (options.exclude?.(sourcePath)) return undefined;

      const doc = parseFolioDoc(sourcePath, readFileSync(file, "utf8"));
      const path = options.route?.(sourcePath, doc) ?? doc.path;
      return { ...doc, path: normalizeRoute(path) };
    })
    .filter((doc): doc is FolioDoc => Boolean(doc))
    .sort(compareFolioDocs);

  const roots = [
    ...new Set(
      docs
        .map((doc) => doc.sourcePath.split("/")[0])
        .filter((root) => Boolean(root) && root.endsWith(".md") === false),
    ),
  ];

  return { docs, roots };
}

export function folio(options: FolioPluginOptions): Plugin {
  const root = process.cwd();
  const contentDir = resolve(root, options.contentDir ?? "content");
  let base = "/";
  let outDir = resolve(root, "dist");

  return {
    name: "folio",
    enforce: "pre",

    configResolved(config) {
      base = config.base;
      outDir = resolve(config.root, config.build.outDir);
    },

    configureServer(server) {
      server.watcher.add(contentDir);
    },

    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_VIRTUAL_ID : undefined;
    },

    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return;
      const manifest = readManifest(contentDir, options);
      return [
        `const docs = ${JSON.stringify(manifest.docs)};`,
        `export const roots = ${JSON.stringify(manifest.roots)};`,
        "export default docs;",
      ].join("\n");
    },

    handleHotUpdate({ file, server }) {
      if (!file.startsWith(contentDir)) return;
      const module = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
      if (module) server.moduleGraph.invalidateModule(module);
      server.ws.send({ type: "full-reload" });
      return [];
    },

    writeBundle() {
      if (options.staticRoutes === false) return;

      const manifest = readManifest(contentDir, options);
      const staticOptions =
        typeof options.staticRoutes === "object" ? options.staticRoutes : {};
      writeFolioStaticSite(
        {
          config: options.config,
          docs: manifest.docs,
          roots: manifest.roots,
          base,
          outDir,
        },
        staticOptions,
      );
    },
  };
}

export type {
  FolioStaticBuildContext,
  FolioStaticBuildOptions,
  FolioStaticImageMetadata,
  FolioStaticRoute,
} from "./static";
export {
  folioAbsoluteAssetUrl,
  folioAbsoluteRouteUrl,
  folioEscapeHtml,
  renderFolioStaticHtml,
  writeFolioStaticSite,
} from "./static";

export const folioVirtualModule = VIRTUAL_ID;
