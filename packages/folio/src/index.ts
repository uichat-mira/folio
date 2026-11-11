export { FolioApp } from "./app";
export { resolveFolioReaderKind, shouldShowFolioPageFooter } from "./ui/page-presentation";
export type { FolioReaderKind } from "./ui/page-presentation";
export { FolioHeader } from "./ui/header";
export { FolioFooter } from "./ui/footer";
export type { FolioFooterProps } from "./ui/footer";
export { FolioUtilityPopover } from "./ui/popover";
export type { FolioUtilityPopoverProps } from "./ui/popover";
export { FolioDocsShell } from "./docs-shell";
export { FolioDocMeta } from "./ui/doc-meta";
export { FolioDocumentBody } from "./document-body";
export type { FolioDocMetaProps } from "./ui/doc-meta";
export { getFolioDocMeta, getFolioDocByline } from "./core/doc-meta";
export type { FolioDocMetaField, FolioDocByline } from "./core/doc-meta";
export { FolioPageNav } from "./ui/page-nav";
export type { FolioPageNavProps } from "./ui/page-nav";
export { FolioTreeNav } from "./ui/tree-nav";
export type { FolioTreeNavProps, FolioTreeExpansionProps } from "./ui/tree-nav";
export { FolioToc } from "./ui/toc";
export type { FolioTocProps } from "./ui/toc";
export { buildFolioOutlineTree } from "./core/outline";
export type { FolioOutlineNode } from "./core/outline";
export type { FolioDocsShellProps } from "./docs-shell";
export type { FolioHeaderProps } from "./ui/header";
export { FolioShareButton } from "./share";
export type { FolioShareButtonProps } from "./share";
export { FolioMarkdown } from "./markdown-react";
export type { FolioMarkdownProps } from "./markdown-react";
export { searchFolioDocs } from "./core/search";
// FOL-039: the update-check throttle policy shipped with the optional PWA
// integration. Pure Core logic (no DOM, no React, no Workbox), exported so a
// consumer with its own update UI can reuse the same policy instead of writing
// a second one. The integration itself stays behind `@uichat-mira/folio/pwa`.
export {
  FOLIO_PWA_UPDATE_CHECK_INTERVAL_MS,
  folioPwaRegistrationState,
  shouldCheckFolioPwaUpdate,
} from "./core/pwa-update";
export type {
  FolioPwaRegistrationInput,
  FolioPwaRegistrationState,
} from "./core/pwa-update";
export { normalizeFolioCollectionPath, selectFolioCollectionDocs, folioCollectionIndexes, assertNoFolioCollectionConflicts } from "./core/collection-index";
export type { FolioCollectionIndex } from "./core/collection-index";
// FOL-040: Article category/tag archives are pure Core data. The index builder
// groups the caller's own FolioDoc[]; archive page rendering stays in the
// Build/UI layers.
export {
  buildFolioArticleArchiveIndex,
  findFolioArticleArchiveGroup,
  folioArticleArchiveSlug,
  normalizeFolioArticleArchiveId,
} from "./core/article-archive";
export type {
  FolioArticleArchiveGroup,
  FolioArticleArchiveIndex,
  FolioArticleArchiveKind,
} from "./core/article-archive";
export { resolveFolioHome } from "./core/home";
export { resolveFolioAppearance, resolveFolioCodePalette } from "./core/appearance";
export type { FolioResolvedAppearance } from "./core/appearance";
export {
  folioNavHref,
  isFolioNavItemActive,
  groupEntries,
  resolveFolioNavigation,
} from "./core/navigation";
export type {
  FolioNavLinkItem,
  FolioNavMenuEntry,
  FolioNavMenuGroup,
  FolioNavMenuItem,
  FolioResolvedNavItem,
} from "./core/navigation";
export type {
  FolioHomeAboutSection,
  FolioHomeCollectionsSection,
  FolioHomeFeaturedSection,
  FolioHomeIntroSection,
  FolioHomeModel,
  FolioHomeRecentSection,
  FolioHomeSection,
} from "./core/home";
export { buildFolioDocStructure, findFolioDocCollection, getFolioDocNeighbors } from "./core/docs-structure";
export { buildFolioNavigationTree, getFolioNavigationNeighbors } from "./core/navigation-tree";
export type { FolioNavigationTree, FolioNavigationNode, FolioNavigationTreeOptions } from "./core/navigation-tree";
export { buildFolioContentTree, resolveFolioProjectTree, getFolioTreeNeighbors, folioTreeDisplayLabel } from "./core/content-tree";
export type { FolioContentTree, FolioContentTreeNode, FolioContentTreeOptions } from "./core/content-tree";
export type { FolioDocCollection, FolioDocSection, FolioDocStructure } from "./core/docs-structure";
export {
  defineFolioConfig,
  normalizeBasePath,
  resolveGithubPagesBase,
} from "./core/config";
export {
  compareFolioDocs,
  extractHeadings,
  parseFrontmatter,
  parseFolioDoc,
  slugify,
  sourcePathToRoute,
} from "./core/content";
export { renderFolioMarkdown } from "./core/markdown";
export type { FolioMarkdownRenderOptions } from "./core/markdown";
export type {
  FolioAuthor,
  FolioAppearanceConfig,
  FolioCodePalette,
  FolioColorSchemePreference,
  FolioVisualPreset,
  FolioArticleArchiveConfig,
  FolioGitHistory,
  FolioGitRevision,
  FolioConfig,
  FolioCollectionConfig,
  FolioDateSource,
  FolioDateSources,
  FolioFooterBrand,
  FolioFooterConfig,
  FolioFooterGroup,
  FolioFooterLegal,
  FolioFooterLink,
  FolioDoc,
  FolioPageNavTarget,
  FolioPageNavNeighbors,
  FolioHomeAboutSectionConfig,
  FolioHomeCollectionsSectionConfig,
  FolioHomeConfig,
  FolioHomeFeaturedSectionConfig,
  FolioHomeIntroSectionConfig,
  FolioHomeMetaConfig,
  FolioHomeRecentSectionConfig,
  FolioHomeSectionConfig,
  FolioHomeSectionType,
  FolioEntryType,
  FolioHeading,
  FolioNavigationChild,
  FolioNavigationIconName,
  FolioNavigationItem,
  FolioNavigationPanel,
} from "./types";
export type {
  FolioAppProps,
  FolioSlots,
  FolioThemePreference,
  FolioUiOptions,
} from "./ui-types";
