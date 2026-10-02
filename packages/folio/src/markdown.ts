import { marked } from "marked";
import { slugify } from "./content";

export type FolioMarkdownRenderOptions = {
  removeH1?: boolean;
  headingAnchors?: boolean;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] || character;
  });
}

function removeMarkdownH1(source: string): string {
  let fence: string | undefined;
  return source
    .split(/\r?\n/)
    .filter((line) => {
      const fenceMatch = line.match(/^\s*(```+|~~~+)/);
      if (fenceMatch) {
        fence = fence ? undefined : fenceMatch[1][0];
        return true;
      }
      return Boolean(fence) || !/^#\s+/.test(line);
    })
    .join("\n");
}

export function renderFolioMarkdown(
  source: string,
  options: FolioMarkdownRenderOptions = {},
): string {
  const htmlBlocks: string[] = [];
  const input = options.removeH1 ? removeMarkdownH1(source) : source;
  const prepared = input
    .replace(
      /::: tip\s+([\s\S]*?):::/g,
      '<div class="md-custom-block"><strong>提示</strong><p>$1</p></div>',
    )
    .replace(/::: html\s*([\s\S]*?):::/g, (_, html: string) => {
      const index = htmlBlocks.push(html.trim()) - 1;
      return `FOLIO_HTML_BLOCK_${index}`;
    });

  const renderer = new marked.Renderer();
  renderer.code = ({ text, lang }) => {
    const language = lang?.trim().toLowerCase();
    if (language === "mermaid") {
      return `<pre class="markdown-mermaid-source"><code class="language-mermaid">${escapeHtml(text)}</code></pre>`;
    }
    const languageClass =
      language && /^[a-z0-9-]+$/.test(language)
        ? ` class="language-${language}"`
        : "";
    return `<pre><code${languageClass}>${escapeHtml(text)}</code></pre>`;
  };

  let html = marked.parse(prepared, { gfm: true, renderer }) as string;
  htmlBlocks.forEach((block, index) => {
    const placeholder = `FOLIO_HTML_BLOCK_${index}`;
    html = html.replace(new RegExp(`<p>${placeholder}<\\/p>|${placeholder}`, "g"), block);
  });

  if (options.headingAnchors === false) return html;

  return html.replace(
    /<h([23])((?:\s[^>]*)?)>([\s\S]*?)<\/h\1>/g,
    (_, level: string, attributes: string, text: string) => {
      if (/\bid\s*=\s*["'][^"']+["']/i.test(attributes)) {
        return `<h${level}${attributes}>${text}</h${level}>`;
      }
      const id = slugify(text);
      return id
        ? `<h${level}${attributes} id="${id}">${text}<a class="md-anchor" href="#${id}">#</a></h${level}>`
        : `<h${level}${attributes}>${text}</h${level}>`;
    },
  );
}
