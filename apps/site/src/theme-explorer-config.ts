import type {
  FolioHomeTemplate,
  FolioResolvedAppearance,
} from "@uichat-mira/folio";

/** A complete, copyable dev-line folio.config.ts using only public fields. */
export function createFolioThemeConfig(
  appearance: FolioResolvedAppearance,
  template: FolioHomeTemplate,
): string {
  return [
    'import { defineFolioConfig } from "@uichat-mira/folio";',
    "",
    "export default defineFolioConfig({",
    '  title: "我的 Folio 站点",',
    '  description: "由 Folio 构建的内容与门户",',
    "  appearance: {",
    `    preset: ${JSON.stringify(appearance.preset)},`,
    `    scheme: ${JSON.stringify(appearance.scheme)},`,
    `    codePalette: ${JSON.stringify(appearance.codePalette)},`,
    "  },",
    `  home: { template: ${JSON.stringify(template)} },`,
    "});",
  ].join("\n");
}
