import { marked } from "marked";
import hljs from "highlight.js/lib/common";
import { slugify } from "./content";
import { createHeadingIdAllocator } from "./heading-ids";

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

function protectFencedCode(source: string): {
  source: string;
  blocks: string[];
} {
  const output: string[] = [];
  const blocks: string[] = [];
  let current: string[] | undefined;
  let fenceCharacter = "";
  let fenceLength = 0;

  for (const line of source.split(/\r?\n/)) {
    if (!current) {
      const opening = line.match(/^\s*(`{3,}|~{3,})/);
      if (!opening) {
        output.push(line);
        continue;
      }

      current = [line];
      fenceCharacter = opening[1][0];
      fenceLength = opening[1].length;
      continue;
    }

    current.push(line);
    const closing = line.match(/^\s*(`+|~+)\s*$/);
    if (
      closing &&
      closing[1][0] === fenceCharacter &&
      closing[1].length >= fenceLength
    ) {
      const index = blocks.push(current.join("\n")) - 1;
      output.push("FOLIO_FENCE_BLOCK_" + index);
      current = undefined;
      fenceCharacter = "";
      fenceLength = 0;
    }
  }

  if (current) {
    const index = blocks.push(current.join("\n")) - 1;
    output.push("FOLIO_FENCE_BLOCK_" + index);
  }

  return { source: output.join("\n"), blocks };
}

export function renderFolioMarkdown(
  source: string,
  options: FolioMarkdownRenderOptions = {},
): string {
  const htmlBlocks: string[] = [];
  const callouts: Array<{ kind: string; body: string }> = [];
  const input = options.removeH1 ? removeMarkdownH1(source) : source;
  const fenced = protectFencedCode(input);

  let prepared = fenced.source
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

  fenced.blocks.forEach((block, index) => {
    prepared = prepared.replace("FOLIO_FENCE_BLOCK_" + index, block);
  });

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
    const highlighted =
      language && hljs.getLanguage(language)
        ? hljs.highlight(text, { language, ignoreIllegals: true }).value
        : hljs.highlightAuto(text).value;
    const languageClass =
      language && /^[a-z0-9-]+$/.test(language)
        ? " language-" + language
        : "";
    return '<pre><code class="hljs' + languageClass + '">' + highlighted + "</code></pre>";
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

  const explicitIds = Array.from(html.matchAll(/<h[2-4]\b([^>]*)>/g))
    .map((match) => match[1].match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1])
    .filter((id): id is string => Boolean(id));
  const headingIds = createHeadingIdAllocator(explicitIds);

  return html.replace(
    /<h([2-4])((?:\s[^>]*)?)>([\s\S]*?)<\/h\1>/g,
    (_, level: string, attributes: string, text: string) => {
      const explicitId = attributes.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1];
      if (explicitId) {
        headingIds.useExplicit(explicitId);
        return "<h" + level + attributes + ">" + text + "</h" + level + ">";
      }
      const base = slugify(text);
      const id = base ? headingIds.allocate(base) : "";
      return id
        ? '<h' + level + attributes + ' id="' + id + '">' + text +
            '<a class="md-anchor" href="#' + id + '" aria-label="链接到 ' +
            escapeHtml(text) + '">#</a></h' + level + ">"
        : "<h" + level + attributes + ">" + text + "</h" + level + ">";
    },
  );
}
