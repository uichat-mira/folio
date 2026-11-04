import {
  folioCollectionIndexes,
  selectFolioCollectionDocs,
  type FolioConfig,
  type FolioDoc,
} from "@uichat-mira/folio";

export type ShowcaseGroup = {
  type: "doc" | "article" | "project" | "page";
  label: string;
  purpose: string;
  docs: FolioDoc[];
};

export type ShowcasePath = {
  label: string;
  docs: FolioDoc[];
};

export type ShowcaseCollection = {
  path: string;
  title: string;
  description: string;
  docs: FolioDoc[];
};

export type ShowcaseHomeModel = {
  stats: {
    docs: number;
    headings: number;
    tags: number;
    collections: number;
  };
  groups: ShowcaseGroup[];
  paths: ShowcasePath[];
  collections: ShowcaseCollection[];
};

const GROUPS: Array<Pick<ShowcaseGroup, "type" | "label" | "purpose">> = [
  {
    type: "doc",
    label: "文档手册",
    purpose: "按 collection / section / order 组织的连续阅读路径，带侧边目录、页内 TOC 与前后篇。",
  },
  {
    type: "article",
    label: "文章与专题",
    purpose: "以日期、作者、标签和长文结构表达观点，详情页自动出现文章目录。",
  },
  {
    type: "project",
    label: "项目档案",
    purpose: "记录目标、范围、现状和决策边界，适合把长期工作放在内容图里。",
  },
  {
    type: "page",
    label: "独立页面",
    purpose: "不进入手册分页的参考页或图谱页，用来承载交叉阅读入口。",
  },
];

const PATHS: Array<{ label: string; paths: string[] }> = [
  {
    label: "先看内容如何被组织，再进入操作示例",
    paths: [
      "/showcase/content-map",
      "/showcase/guides/organize-content",
      "/showcase/guides/collections-and-navigation",
    ],
  },
  {
    label: "从一篇专题文章走到相关项目档案",
    paths: [
      "/blogs/content-stays-in-git",
      "/blogs/one-markdown-many-surfaces",
      "/projects/official-site",
    ],
  },
  {
    label: "从入门文档进入 API 参考与约束说明",
    paths: ["/docs/introduction", "/api/guide/what-is-folio", "/api/reference/frontmatter"],
  },
];

function byType(docs: FolioDoc[], type: ShowcaseGroup["type"]): FolioDoc[] {
  return docs
    .filter((doc) => doc.type === type)
    .sort((left, right) => {
      if (type === "article") {
        return (
          String(right.date ?? "").localeCompare(String(left.date ?? "")) ||
          left.order - right.order
        );
      }
      return left.order - right.order || left.path.localeCompare(right.path);
    });
}

function guideDocs(docs: FolioDoc[]): FolioDoc[] {
  const showcase = docs
    .filter((doc) => doc.type === "doc" && doc.collection === "能力展厅")
    .sort((left, right) => left.order - right.order);
  const rest = docs
    .filter((doc) => doc.type === "doc" && doc.collection !== "能力展厅")
    .sort((left, right) => left.order - right.order);
  return [...showcase, ...rest];
}

export function buildShowcaseHome(
  config: FolioConfig,
  docs: FolioDoc[],
): ShowcaseHomeModel {
  const collections = folioCollectionIndexes(config);
  const groupDocs: Record<ShowcaseGroup["type"], FolioDoc[]> = {
    doc: guideDocs(docs),
    article: byType(docs, "article"),
    project: byType(docs, "project"),
    page: byType(docs, "page"),
  };

  const groups = GROUPS.map((group) => ({
    ...group,
    docs: groupDocs[group.type].slice(0, 3),
  }));

  const paths = PATHS.map((path) => ({
    label: path.label,
    docs: path.paths
      .map((target) => docs.find((doc) => doc.path === target))
      .filter((doc): doc is FolioDoc => Boolean(doc)),
  })).filter((path) => path.docs.length > 0);

  return {
    stats: {
      docs: docs.filter((doc) => doc.path !== "/").length,
      headings: docs.reduce((sum, doc) => sum + doc.headings.length, 0),
      tags: new Set(docs.flatMap((doc) => doc.tags)).size,
      collections: collections.length,
    },
    groups,
    paths,
    collections: collections.map((collection) => ({
      path: collection.path,
      title: collection.title,
      description: collection.description,
      docs: selectFolioCollectionDocs(docs, collection.path).slice(0, 3),
    })),
  };
}
