import {
  useEffect,
  useMemo,
  useRef,
  type HTMLAttributes,
} from "react";
import {
  renderFolioMarkdown,
  type FolioMarkdownRenderOptions,
} from "./markdown";

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
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let rendering = false;
    let queued = false;

    async function renderMermaid() {
      if (rendering) {
        queued = true;
        return;
      }

      const nodes = Array.from(
        container.querySelectorAll<HTMLElement>("[data-mermaid]"),
      );
      if (!nodes.length) return;

      rendering = true;
      try {
        const { default: mermaid } = await import("mermaid");
        if (cancelled) return;

        const dark =
          document.documentElement.dataset.folioTheme === "dark";

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: dark ? "dark" : "base",
          themeVariables: dark
            ? undefined
            : {
                fontFamily: "Public Sans, sans-serif",
                primaryColor: "#efe9de",
                primaryTextColor: "#141413",
                lineColor: "#cc785c",
                secondaryColor: "#f5f0e8",
                tertiaryColor: "#faf9f5",
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
      attributeFilter: ["data-folio-theme"],
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
