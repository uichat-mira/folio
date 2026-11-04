const MARKDOWN_ROOT_LINK = /(\]\(\s*)(\/(?!\/)[^)\s]*)/g;
const HTML_ROOT_LINK = /(\b(?:href|src)\s*=\s*["'])(\/(?!\/)[^"']*)/gi;

export function withSiteBaseLinks(source: string, basePath: string): string {
  const base = basePath.replace(/\/+$/, "");
  if (!base) return source;

  const prefix = base.startsWith("/") ? base : `/${base}`;
  return source
    .replace(MARKDOWN_ROOT_LINK, (_, start: string, path: string) => `${start}${prefix}${path}`)
    .replace(HTML_ROOT_LINK, (_, start: string, path: string) => `${start}${prefix}${path}`);
}
