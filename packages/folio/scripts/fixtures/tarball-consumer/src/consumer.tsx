import {
  FolioApp,
  buildFolioDocStructure,
  defineFolioConfig,
  getFolioDocNeighbors,
  parseFolioDoc,
  renderFolioMarkdown,
  resolveFolioHome,
  resolveGithubPagesBase,
  searchFolioDocs,
  type FolioAppProps,
  type FolioConfig,
  type FolioDoc,
  type FolioDocCollection,
  type FolioDocSection,
  type FolioDocsShellProps,
  type FolioDocStructure,
  type FolioEntryType,
  type FolioHeaderProps,
  type FolioHeading,
  type FolioHomeConfig,
  type FolioHomeModel,
  type FolioHomeSectionConfig,
  type FolioHomeSectionType,
  type FolioMarkdownProps,
  type FolioMarkdownRenderOptions,
  type FolioNavigationItem,
  type FolioShareButtonProps,
  type FolioSlots,
  type FolioThemePreference,
  type FolioUiOptions,
} from "@uichat-mira/folio";
import virtualDocs, { roots as virtualRoots } from "virtual:folio/content";
import {
  folio,
  folioEscapeHtml,
  folioVirtualModule,
  renderFolioStaticHome,
  type FolioPluginOptions,
  type FolioStaticHomeOverride,
} from "@uichat-mira/folio/vite";

// Every published type name must resolve from the tarball root entry. This is
// a type-only surface: it proves the declarations exist and are structurally
// usable, without adding runtime code to the consumer.
type PublicTypeSurface = {
  appProps: FolioAppProps;
  docsShellProps: FolioDocsShellProps;
  headerProps: FolioHeaderProps;
  shareButtonProps: FolioShareButtonProps;
  markdownProps: FolioMarkdownProps;
  markdownOptions: FolioMarkdownRenderOptions;
  collection: FolioDocCollection;
  section: FolioDocSection;
  structure: FolioDocStructure;
  doc: FolioDoc;
  config: FolioConfig;
  navigationItem: FolioNavigationItem;
  slots: FolioSlots;
  themePreference: FolioThemePreference;
  uiOptions: FolioUiOptions;
  entryType: FolioEntryType;
  heading: FolioHeading;
  homeConfig: FolioHomeConfig;
  homeSectionConfig: FolioHomeSectionConfig;
  homeSectionType: FolioHomeSectionType;
  homeModel: FolioHomeModel;
  staticHome: FolioStaticHomeOverride;
};

export type { PublicTypeSurface };


// A standalone TypeScript consumer of the installed tarball. It only uses the
// package's public entrypoints and its own installed peer dependency types.
const config: FolioConfig = defineFolioConfig({
  title: "Folio tarball consumer",
  description: "Standalone type check of the published package shape.",
  base: resolveGithubPagesBase("uichat-mira/folio"),
  navigation: [{ label: "Docs", href: "/docs" }],
  home: {
    sections: [
      { type: "intro", title: "Home" },
      { type: "recent", limit: 2 },
    ],
  },
});

const docs: FolioDoc[] = [
  parseFolioDoc(
    "docs/intro.md",
    "---\ntitle: Intro\ndescription: First document\n---\n# Intro\n",
  ),
];

const staticHome: FolioStaticHomeOverride = ({ base }) => ({
  body: '<main><a href="' + base + 'docs/intro/">Intro</a></main>',
});
const pluginOptions: FolioPluginOptions = {
  config,
  contentDir: "content",
  staticRoutes: { home: staticHome },
};

const structure = buildFolioDocStructure(docs);
const neighbors = getFolioDocNeighbors(docs, docs[0]);
const results = searchFolioDocs(docs, "intro");
const html: string = renderFolioMarkdown("# Intro");
const homeModel: FolioHomeModel = resolveFolioHome(config, docs);
const escaped: string = folioEscapeHtml("<script>");
const virtualModule: string = folioVirtualModule;
// Strict NodeNext check: both virtual exports must be provided by the packed
// Folio declaration. This fixture intentionally has no local declare module.
const typedVirtualDocs: FolioDoc[] = virtualDocs;
const typedVirtualRoots: string[] = virtualRoots;
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
    homeModel,
    renderFolioStaticHome instanceof Function,
    virtualModule,
    typedVirtualDocs,
    typedVirtualRoots,
    plugin,
    app,
    missingDescription,
    missingConfig,
  ];
}
