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

/** Only standalone ::: directives are blocks. Inline examples such as
 * ::: html in code spans are ordinary Markdown and must not swallow prose.
 * Fenced code has already been replaced by placeholders at this point. */
function protectCustomBlocks(source: string): {
  source: string;
  htmlBlocks: string[];
  callouts: Array<{ kind: string; body: string }>;
} {
  const lines = source.split(/\r?\n/);
  const output: string[] = [];
  const htmlBlocks: string[] = [];
  const callouts: Array<{ kind: string; body: string }> = [];
  const openingPattern = /^[ \t]{0,3}:::[ \t]*(html|tip|info|note|warning|danger)(?:[ \t]+(.*))?[ \t]*$/;
  const inlinePattern = /^[ \t]{0,3}:::[ \t]*(html|tip|info|note|warning|danger)[ \t]+(.+?)[ \t]*:::[ \t]*$/;
  const closingPattern = /^[ \t]{0,3}:::[ \t]*$/;

  for (let i = 0; i < lines.length; i++) {
    const inline = lines[i].match(inlinePattern);
    if (inline) {
      const kind = inline[1];
      const body = inline[2].trim();
      if (kind === "html") {
        output.push("FOLIO_HTML_BLOCK_" + (htmlBlocks.push(body) - 1));
      } else {
        output.push("FOLIO_CALLOUT_BLOCK_" + (callouts.push({ kind, body }) - 1));
      }
      continue;
    }

    const opening = lines[i].match(openingPattern);
    if (!opening) {
      output.push(lines[i]);
      continue;
    }

    let closingIndex = i + 1;
    while (closingIndex < lines.length && !closingPattern.test(lines[closingIndex])) {
      closingIndex++;
    }
    if (closingIndex === lines.length) {
      // Unfinished directives remain Markdown, not a license to consume
      // everything following the opener.
      output.push(lines[i]);
      continue;
    }

    const kind = opening[1];
    const firstLine = opening[2]?.trim();
    const inner = lines.slice(i + 1, closingIndex).join("\n");
    const body = (firstLine ? firstLine + "\n" : "") + inner;
    if (kind === "html") {
      output.push("FOLIO_HTML_BLOCK_" + (htmlBlocks.push(body.trim()) - 1));
    } else {
      output.push("FOLIO_CALLOUT_BLOCK_" + (callouts.push({ kind, body: body.trim() }) - 1));
    }
    i = closingIndex;
  }

  return { source: output.join("\n"), htmlBlocks, callouts };
}

export function renderFolioMarkdown(
  source: string,
  options: FolioMarkdownRenderOptions = {},
): string {
  const input = options.removeH1 ? removeMarkdownH1(source) : source;
  const fenced = protectFencedCode(input);
  const { source: blockSource, htmlBlocks, callouts } = protectCustomBlocks(fenced.source);
  const restoreFencedCode = (value: string): string =>
    value.replace(/FOLIO_FENCE_BLOCK_(\d+)/g, (placeholder, index: string) =>
      fenced.blocks[Number(index)] ?? placeholder);
  const prepared = restoreFencedCode(blockSource);

  const renderer = new marked.Renderer();
  // Tables keep their semantics but scroll inside the reading column: their
  // min-content width comes from unbreakable inline code, so without a scroll
  // container a wide table expands the whole document on narrow screens.
  const renderTable = renderer.table.bind(renderer);
  renderer.table = (token) =>
    '<div class="folio-table-scroll" tabindex="0">' + renderTable(token) + "</div>";
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
    // A semantic frame belongs to the Markdown renderer, not to a second
    // client-only wrapper. Do not synthesize shell prompts into copyable code.
    const terminal = Boolean(language && /^(?:sh|bash|zsh|shell|console|terminal|powershell|ps1)$/.test(language));
    const displayNames: Record<string, string> = {
      ts: "TypeScript", typescript: "TypeScript", tsx: "TSX",
      js: "JavaScript", javascript: "JavaScript", jsx: "JSX",
      py: "Python", python: "Python", json: "JSON",
      yml: "YAML", yaml: "YAML", html: "HTML", css: "CSS",
      md: "Markdown", markdown: "Markdown",
    };
    const caption = terminal
      ? "Terminal"
      : language && /^[a-z0-9+#.-]{1,24}$/.test(language)
        ? displayNames[language] ?? language.toUpperCase()
        : "Code";
    return '<figure class="folio-code-frame' +
      (terminal ? ' folio-code-frame--terminal' : '') +
      '"><figcaption class="folio-code-frame__header"><span class="folio-code-frame__mark" aria-hidden="true"></span>' +
      '<span>' + escapeHtml(caption) + '</span></figcaption>' +
      '<pre><code class="hljs' + languageClass + '">' + highlighted +
      "</code></pre></figure>";
  };

  let html = marked.parse(prepared, { gfm: true, renderer }) as string;

  htmlBlocks.forEach((block, index) => {
    const placeholder = "FOLIO_HTML_BLOCK_" + index;
    html = html.replace(
      new RegExp("<p>" + placeholder + "<\\/p>|" + placeholder, "g"),
      restoreFencedCode(block),
    );
  });

  callouts.forEach(({ kind, body }, index) => {
    const placeholder = "FOLIO_CALLOUT_BLOCK_" + index;
    const label = calloutLabels[kind] ?? kind;
    const bodyHtml = marked.parse(restoreFencedCode(body), { gfm: true, renderer }) as string;
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

  const explicitIds = Array.from(html.matchAll(/<h[2-4]\b([^>]*)>/gi))
    .map((match) => match[1].match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1])
    .filter((id): id is string => Boolean(id));
  const headingIds = createHeadingIdAllocator(explicitIds);

  return html.replace(
    /<h([2-4])((?:\s[^>]*)?)>([\s\S]*?)<\/h\1>/gi,
    (_, level: string, attributes: string, text: string) => {
      const explicitId = attributes.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1];
      if (explicitId) {
        headingIds.useExplicit(explicitId);
        return "<h" + level + attributes + ">" + text + "</h" + level + ">";
      }
      // Match extractHeadings for headings whose visible text has no slug chars.
      const id = headingIds.allocate(slugify(text) || "section");
      return '<h' + level + attributes + ' id="' + id + '">' + text +
        '<a class="md-anchor" href="#' + id + '" aria-label="链接到 ' +
        escapeHtml(text) + '">#</a></h' + level + ">";
    },
  );
}
