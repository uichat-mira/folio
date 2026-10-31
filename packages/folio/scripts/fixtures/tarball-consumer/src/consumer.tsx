import {
  FolioApp,
  buildFolioDocStructure,
  defineFolioConfig,
  getFolioDocNeighbors,
  parseFolioDoc,
  renderFolioMarkdown,
  resolveGithubPagesBase,
  searchFolioDocs,
  type FolioConfig,
  type FolioDoc,
} from "@uichat-mira/folio";
import {
  folio,
  folioEscapeHtml,
  folioVirtualModule,
  type FolioPluginOptions,
} from "@uichat-mira/folio/vite";

// A standalone TypeScript consumer of the installed tarball. It only uses the
// package's public entrypoints and its own installed peer dependency types.
const config: FolioConfig = defineFolioConfig({
  title: "Folio tarball consumer",
  description: "Standalone type check of the published package shape.",
  base: resolveGithubPagesBase("uichat-mira/folio"),
  navigation: [{ label: "Docs", href: "/docs" }],
});

const docs: FolioDoc[] = [
  parseFolioDoc(
    "docs/intro.md",
    "---\ntitle: Intro\ndescription: First document\n---\n# Intro\n",
  ),
];

const pluginOptions: FolioPluginOptions = {
  config,
  contentDir: "content",
  staticRoutes: false,
};

const structure = buildFolioDocStructure(docs);
const neighbors = getFolioDocNeighbors(docs, docs[0]);
const results = searchFolioDocs(docs, "intro");
const html: string = renderFolioMarkdown("# Intro");
const escaped: string = folioEscapeHtml("<script>");
const virtualModule: string = folioVirtualModule;
const plugin = folio(pluginOptions);
const app = <FolioApp config={config} docs={docs} />;

// @ts-expect-error FolioConfig requires both title and description.
const missingDescription: FolioConfig = { title: "Only a title" };

// @ts-expect-error FolioPluginOptions requires config.
const missingConfig: FolioPluginOptions = { contentDir: "content" };

export function consumerSurface(): unknown[] {
  return [
    structure,
    neighbors,
    results,
    html,
    escaped,
    virtualModule,
    plugin,
    app,
    missingDescription,
    missingConfig,
  ];
}
