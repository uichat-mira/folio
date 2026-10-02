import { marked } from "marked";
import { slugify } from "./content";

export type FolioMarkdownRenderOptions = {
  removeH1?: boolean;
  headingAnchors?: boolean;
};

const calloutLabels: Record<string, string> = {
  tip: "提示",
  info: "信息",
  note: "说明",
  warning: "注意",
  danger: "警告",
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
  const callouts: Array<{ kind: string; body: string }> = [];
  const input = options.removeH1 ? removeMarkdownH1(source) : source;

  const prepared = input
    .replace(/::: html\s*([\s\S]*?):::/g, (_, html: string) => {
      const index = htmlBlocks.push(html.trim()) - 1;
      return "FOLIO_HTML_BLOCK_" + index;
    })
    .replace(
      /:::\s*(tip|info|note|warning|danger)\s+([\s\S]*?):::/g,
      (_, kind: string, body: string) => {
        const index = callouts.push({ kind, body: body.trim() }) - 1;
        return "FOLIO_CALLOUT_BLOCK_" + index;
      },
    );

  const renderer = new marked.Renderer();
  renderer.code = ({ text, lang }) => {
    const language = lang?.trim().toLowerCase();
    if (language === "mermaid") {
      const escaped = escapeHtml(text);
      return '<div class="markdown-mermaid" data-mermaid data-mermaid-source="' +
        escaped +
        '"><pre class="markdown-mermaid-source"><code class="language-mermaid">' +
        escaped +
        "</code></pre></div>";
    }
    const languageClass =
      language && /^[a-z0-9-]+$/.test(language)
        ? ' class="language-' + language + '"'
        : "";
    return "<pre><code" + languageClass + ">" + escapeHtml(text) + "</code></pre>";
  };

  let html = marked.parse(prepared, { gfm: true, renderer }) as string;

  htmlBlocks.forEach((block, index) => {
    const placeholder = "FOLIO_HTML_BLOCK_" + index;
    html = html.replace(
      new RegExp("<p>" + placeholder + "<\\/p>|" + placeholder, "g"),
      block,
    );
  });

  callouts.forEach(({ kind, body }, index) => {
    const placeholder = "FOLIO_CALLOUT_BLOCK_" + index;
    const label = calloutLabels[kind] ?? kind;
    const bodyHtml = marked.parse(body, { gfm: true, renderer }) as string;
    const block =
      '<aside class="md-custom-block md-custom-block--' +
      kind +
      '"><strong class="md-custom-block__title">' +
      label +
      '</strong><div class="md-custom-block__body">' +
      bodyHtml +
      "</div></aside>";
    html = html.replace(
      new RegExp("<p>" + placeholder + "<\\/p>|" + placeholder, "g"),
      block,
    );
  });

  if (options.headingAnchors === false) return html;

  return html.replace(
    /<h([23])((?:\s[^>]*)?)>([\s\S]*?)<\/h\1>/g,
    (_, level: string, attributes: string, text: string) => {
      if (/\bid\s*=\s*["'][^"']+["']/i.test(attributes)) {
        return "<h" + level + attributes + ">" + text + "</h" + level + ">";
      }
      const id = slugify(text);
      return id
        ? '<h' + level + attributes + ' id="' + id + '">' + text +
            '<a class="md-anchor" href="#' + id + '" aria-label="链接到 ' +
            escapeHtml(text) + '">#</a></h' + level + ">"
        : "<h" + level + attributes + ">" + text + "</h" + level + ">";
    },
  );
}
