import { useMemo, type HTMLAttributes } from "react";
import {
  renderFolioMarkdown,
  type FolioMarkdownRenderOptions,
} from "./markdown";

export type FolioMarkdownProps = {
  source: string;
  options?: FolioMarkdownRenderOptions;
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "dangerouslySetInnerHTML">;

export function FolioMarkdown({
  source,
  options,
  className = "folio-markdown",
  ...props
}: FolioMarkdownProps) {
  const html = useMemo(
    () => renderFolioMarkdown(source, options),
    [source, options?.headingAnchors, options?.removeH1],
  );

  return (
    <article
      {...props}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
