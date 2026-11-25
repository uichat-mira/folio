export type LiveFolioToken = { name: string; value: string };
export type DesignTokenKind = "semantic" | "code" | "type" | "scale";

/** Classify names for docs; never own duplicate CSS values. */
export function designTokenKind(name: string): DesignTokenKind {
  if (name.startsWith("--folio-code-") || name.startsWith("--folio-syntax-")) return "code";
  if (name.startsWith("--folio-font-")) return "type";
  if (/^--folio-(space-|radius-|header-height$|.*-frame-width$)/.test(name)) return "scale";
  return "semantic";
}

/** Only actual browser-computed Folio tokens reach the live catalogue. */
export function collectFolioTokens(style: Pick<CSSStyleDeclaration, "length" | "item" | "getPropertyValue">): LiveFolioToken[] {
  return Array.from({ length: style.length }, (_, index) => style.item(index))
    .filter((name) => name.startsWith("--folio-"))
    .map((name) => ({ name, value: style.getPropertyValue(name).trim() }))
    .filter((entry) => entry.value.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}
