import { compareFolioDocs, slugify } from "./content";
import type { FolioDoc } from "./types";

export type FolioDocSection = {
  id: string;
  title: string;
  docs: FolioDoc[];
};

export type FolioDocCollection = {
  id: string;
  title: string;
  sections: FolioDocSection[];
  docs: FolioDoc[];
};

export type FolioDocStructure = {
  collections: FolioDocCollection[];
};

function collectionTitle(doc: FolioDoc): string {
  return doc.collection?.trim() || "文档";
}

function collectionId(doc: FolioDoc): string {
  return slugify(doc.collection?.trim() || "docs") || "docs";
}

function sectionTitle(doc: FolioDoc): string {
  return doc.section?.trim() || doc.group?.trim() || "文档";
}

export function buildFolioDocStructure(docs: FolioDoc[]): FolioDocStructure {
  const collections = new Map<
    string,
    {
      title: string;
      docs: FolioDoc[];
      sections: Map<string, { title: string; docs: FolioDoc[] }>;
    }
  >();

  for (const doc of docs.filter((item) => item.type === "doc")) {
    const cId = collectionId(doc);
    const cTitle = collectionTitle(doc);
    const sTitle = sectionTitle(doc);
    const sId = slugify(sTitle) || "docs";
    const collection =
      collections.get(cId) ?? {
        title: cTitle,
        docs: [],
        sections: new Map(),
      };
    collection.docs.push(doc);

    const section =
      collection.sections.get(sId) ?? {
        title: sTitle,
        docs: [] as FolioDoc[],
      };
    section.docs.push(doc);
    collection.sections.set(sId, section);
    collections.set(cId, collection);
  }

  const result = [...collections.entries()].map(([id, value]) => {
    const docs = [...value.docs].sort(compareFolioDocs);
    const sections = [...value.sections.entries()]
      .map(([sectionId, section]) => ({
        id: sectionId,
        title: section.title,
        docs: [...section.docs].sort(compareFolioDocs),
      }))
      .sort((left, right) => {
        const leftOrder = left.docs[0]?.order ?? 99;
        const rightOrder = right.docs[0]?.order ?? 99;
        return leftOrder - rightOrder || left.title.localeCompare(right.title);
      });

    return {
      id,
      title: value.title,
      sections,
      docs,
    };
  });

  result.sort((left, right) => {
    const leftOrder = left.docs[0]?.order ?? 99;
    const rightOrder = right.docs[0]?.order ?? 99;
    return leftOrder - rightOrder || left.title.localeCompare(right.title);
  });

  return { collections: result };
}

export function findFolioDocCollection(
  docs: FolioDoc[],
  current: FolioDoc,
): FolioDocCollection | undefined {
  const target = collectionId(current);
  return buildFolioDocStructure(docs).collections.find(
    (collection) => collection.id === target,
  );
}

export function getFolioDocNeighbors(
  docs: FolioDoc[],
  current: FolioDoc,
): { previous?: FolioDoc; next?: FolioDoc } {
  const collection = findFolioDocCollection(docs, current);
  if (!collection) return {};

  const ordered = collection.sections.flatMap((section) => section.docs);
  const index = ordered.findIndex((doc) => doc.path === current.path);
  if (index < 0) return {};

  return {
    previous: index > 0 ? ordered[index - 1] : undefined,
    next: index + 1 < ordered.length ? ordered[index + 1] : undefined,
  };
}
