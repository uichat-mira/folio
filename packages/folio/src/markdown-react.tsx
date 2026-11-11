import {
  useEffect,
  useMemo,
  useRef,
  type HTMLAttributes,
} from "react";
import {
  renderFolioMarkdown,
  type FolioMarkdownRenderOptions,
} from "./core/markdown";

let mermaidRenderSequence = 0;

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
  const containerRef = useRef<HTMLElement>(null);
  const html = useMemo(
    () => renderFolioMarkdown(source, options),
    [source, options?.headingAnchors, options?.removeH1],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    let rendering = false;
    let queued = false;

    async function renderMermaid() {
      if (rendering) {
        queued = true;
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      const nodes = Array.from(
        container.querySelectorAll<HTMLElement>("[data-mermaid]"),
      );
      if (!nodes.length) return;

      rendering = true;
      try {
        const { default: mermaid } = await import("mermaid");
        if (cancelled) return;

        // Diagram colors follow the effective semantic palette, never the
        // code highlighter theme. Computed values handle brand CSS overrides.
        const rootStyle = getComputedStyle(document.documentElement);
        const token = (name: string) =>
          rootStyle.getPropertyValue(`--folio-${name}`).trim();

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
            fontFamily: token("font-sans"),
            background: token("canvas"),
            primaryColor: token("surface-card"),
            primaryTextColor: token("ink"),
            primaryBorderColor: token("hairline"),
            secondaryColor: token("surface-soft"),
            tertiaryColor: token("canvas"),
            lineColor: token("primary"),
            textColor: token("body"),
            mainBkg: token("surface-card"),
            nodeBorder: token("hairline"),
          },
        });

        for (const node of nodes) {
          const sourceCode = node.dataset.mermaidSource || "";
          if (!sourceCode) continue;

          try {
            const result = await mermaid.render(
              "folio-mermaid-" + ++mermaidRenderSequence,
              sourceCode,
            );
            if (!cancelled) node.innerHTML = result.svg;
          } catch (error) {
            // A theme change may fail *after* a previous SVG succeeded. Always
            // restore readable source, not a stale diagram in the wrong theme.
            if (!cancelled) {
              const pre = document.createElement("pre");
              pre.className = "markdown-mermaid-source";
              pre.textContent = sourceCode;
              node.replaceChildren(pre);
            }
            console.warn(
              "Folio Mermaid render failed; source fallback is preserved.",
              error,
            );
          }
        }
      } catch (error) {
        console.warn(
          "Folio Mermaid runtime could not load; source fallback is preserved.",
          error,
        );
      } finally {
        rendering = false;
        if (queued && !cancelled) {
          queued = false;
          void renderMermaid();
        }
      }
    }

    void renderMermaid();

    const observer = new MutationObserver(() => {
      void renderMermaid();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-folio-theme", "data-folio-preset"],
    });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [html]);

  return (
    <article
      {...props}
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
