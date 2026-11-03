// Dependency-free structural XML parser for the FOL-026 feed tests and the
// installed-tarball static consumer check.
//
// This file is test/consumer infrastructure only: it is not part of the
// published package, is not exported from `src/`, and must not become a
// product dependency. It exists so feed assertions inspect a real parsed tree
// instead of matching substrings, while keeping the package dependency-free.
//
// Supported XML subset: one root element, an XML declaration, comments,
// CDATA, self-closing elements, text, the five predefined entities and numeric
// character references. Everything else throws, so a malformed document fails
// the check instead of being silently accepted.
//
// API (deliberately small):
//   parseXml(source)          -> root element node (throws when not well-formed)
//   xmlElements(node)         -> direct element children
//   xmlFind(node, name)       -> first descendant element with that name
//   xmlFindAll(node, name)    -> every descendant element with that name
//   xmlText(node)             -> concatenated, entity-decoded text content
//   xmlAttribute(node, name)  -> attribute value, or undefined
//
// A node is either { type: "element", name, attributes, children } or
// { type: "text", text }.

const ELEMENT_NAME = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
const TAG =
  /^<([A-Za-z_][A-Za-z0-9_.:-]*)((?:\s+[A-Za-z_][A-Za-z0-9_.:-]*\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/;
const ATTRIBUTE =
  /([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const INVALID_XML_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
const BARE_AMPERSAND =
  /&(?!(?:#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);)/;
const ENTITY =
  /&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g;
const PREDEFINED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeEntities(value) {
  if (BARE_AMPERSAND.test(value)) {
    throw new Error(`invalid XML entity reference in ${JSON.stringify(value)}`);
  }
  return value.replace(ENTITY, (reference, body) => {
    if (body[0] !== "#") return PREDEFINED_ENTITIES[body];
    const hex = body[1] === "x" || body[1] === "X";
    const codePoint = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
    if (
      !Number.isFinite(codePoint) ||
      codePoint <= 0 ||
      codePoint > 0x10ffff ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff)
    ) {
      throw new Error(
        `invalid XML character reference ${JSON.stringify(reference)}`,
      );
    }
    return String.fromCodePoint(codePoint);
  });
}

function parseAttributes(source, description) {
  const attributes = {};
  for (const match of source.matchAll(ATTRIBUTE)) {
    const name = match[1];
    if (Object.prototype.hasOwnProperty.call(attributes, name)) {
      throw new Error(`duplicate XML attribute ${JSON.stringify(name)} in ${description}`);
    }
    attributes[name] = decodeEntities(match[2] ?? match[3] ?? "");
  }
  // Reject attribute text the strict pattern above could not consume.
  const consumed = [...source.matchAll(ATTRIBUTE)]
    .map((match) => match[0])
    .join("");
  if (consumed.replace(/\s+/g, "") !== source.replace(/\s+/g, "")) {
    throw new Error(`malformed XML attributes in ${description}`);
  }
  return attributes;
}

/**
 * Parse one XML document and return its root element.
 * Throws on any well-formedness problem the checks rely on.
 */
export function parseXml(source) {
  if (typeof source !== "string") {
    throw new TypeError("parseXml expects an XML string");
  }
  const invalid = source.match(INVALID_XML_CHARACTERS);
  if (invalid) {
    throw new Error(
      `XML contains the invalid control character U+${invalid[0]
        .codePointAt(0)
        .toString(16)
        .toUpperCase()
        .padStart(4, "0")}`,
    );
  }

  const document = { type: "document", children: [] };
  const stack = [document];
  let index = 0;

  const current = () => stack[stack.length - 1];
  const pushText = (raw) => {
    if (!raw) return;
    const text = decodeEntities(raw);
    const parent = current();
    const previous = parent.children[parent.children.length - 1];
    if (previous && previous.type === "text") previous.text += text;
    else parent.children.push({ type: "text", text });
  };

  while (index < source.length) {
    const next = source.indexOf("<", index);
    if (next < 0) {
      pushText(source.slice(index));
      break;
    }
    if (next > index) pushText(source.slice(index, next));
    index = next;

    if (source.startsWith("<?", index)) {
      const end = source.indexOf("?>", index);
      if (end < 0) throw new Error("unterminated XML declaration");
      index = end + 2;
      continue;
    }

    if (source.startsWith("<!--", index)) {
      const end = source.indexOf("-->", index);
      if (end < 0) throw new Error("unterminated XML comment");
      index = end + 3;
      continue;
    }

    if (source.startsWith("<![CDATA[", index)) {
      const end = source.indexOf("]]>", index);
      if (end < 0) throw new Error("unterminated XML CDATA section");
      const parent = current();
      parent.children.push({
        type: "text",
        text: source.slice(index + "<![CDATA[".length, end),
      });
      index = end + 3;
      continue;
    }

    if (source.startsWith("</", index)) {
      const end = source.indexOf(">", index);
      if (end < 0) throw new Error("unterminated XML closing tag");
      const name = source.slice(index + 2, end).trim();
      if (!ELEMENT_NAME.test(name)) {
        throw new Error(`invalid XML closing tag ${JSON.stringify(name)}`);
      }
      const open = stack.pop();
      if (!open || open.type !== "element" || open.name !== name) {
        throw new Error(
          `mismatched XML closing tag </${name}> for <${open?.name ?? "#document"}>`,
        );
      }
      index = end + 1;
      continue;
    }

    const tag = source.slice(index).match(TAG);
    if (!tag) {
      throw new Error(
        `invalid XML element near ${JSON.stringify(source.slice(index, index + 60))}`,
      );
    }
    const [, name, attributeSource, selfClosing] = tag;
    const node = {
      type: "element",
      name,
      attributes: parseAttributes(attributeSource, `<${name}>`),
      children: [],
    };
    current().children.push(node);
    index += tag[0].length;
    if (!selfClosing) stack.push(node);
  }

  if (stack.length !== 1) {
    throw new Error(`unclosed XML element <${current().name}>`);
  }

  const rootElements = document.children.filter((child) => child.type === "element");
  const strayText = document.children.filter(
    (child) => child.type === "text" && child.text.trim() !== "",
  );
  if (rootElements.length !== 1 || strayText.length > 0) {
    throw new Error("XML document must contain exactly one root element and no outer text");
  }
  return rootElements[0];
}

/** Direct element children of one node. */
export function xmlElements(node) {
  return (node.children ?? []).filter((child) => child.type === "element");
}

/** Every descendant element with this name, in document order. */
export function xmlFindAll(node, name) {
  const found = [];
  const visit = (parent) => {
    for (const child of xmlElements(parent)) {
      if (child.name === name) found.push(child);
      visit(child);
    }
  };
  visit(node);
  return found;
}

/** First descendant element with this name, or undefined. */
export function xmlFind(node, name) {
  return xmlFindAll(node, name)[0];
}

/** Concatenated, entity-decoded text content of a node. */
export function xmlText(node) {
  let text = "";
  for (const child of node.children ?? []) {
    text += child.type === "text" ? child.text : xmlText(child);
  }
  return text;
}

/** One attribute value, or undefined when absent. */
export function xmlAttribute(node, name) {
  return node.attributes?.[name];
}
