---
title: 内容组织与排序
description: 用 collection、section 与 order 组织侧栏、阅读顺序和内容分组。
group: 写作
collection: 指南
order: 14
type: doc
status: published
tags:
  - Navigation
  - Content
  - Authoring
---

Folio 的内容组织写在 Frontmatter 里，而不是写死在站点代码里。改导航时不需要搬动文件；搬动文件时才需要同步修改链接。

## 三层归属

| 层 | 写在哪里 | 决定什么 |
| --- | --- | --- |
| `collection` | 页面 Frontmatter | 进入哪个文档侧栏 |
| `section` | 页面 Frontmatter | 侧栏中的哪个分组 |
| `order` | 页面 Frontmatter | 分组内的阅读顺序 |

没有 `section` 时，`group` 作为分组标题。没有 `collection` 的页面回落到字面量「文档」。

## 一个例子

```yaml
---
title: 编写内容
description: 写作流程与发布前检查。
group: 写作
collection: 指南
section: 写作
order: 11
type: doc
---
```

侧栏会按 `collection` 与 `section` 聚合：

```text
指南
├─ 开始
│  ├─ Folio 是什么
│  ├─ 快速开始
│  └─ 内容协议
└─ 写作
   ├─ 编写内容
   ├─ 内容类型与路由
   ├─ Frontmatter 与元数据
   ├─ 内容组织与排序
   └─ Markdown 写作
```

## 排序规则

- `doc`：按 `order` 升序；相同 `order` 按路由字典序。
- `article`：按 `date` 倒序优先，再按 `order`。
- 隐式目录（没有 `index.md` 的目录）：使用子节点最小的 `order`。
- 排序值相同不保证编辑顺序，建议留出间隔：`10`、`20`、`30`，避免插入时重排整组。

## 与站点配置的区别

三个概念容易混：

- `collection` / `section`：写在内容里，决定**文档侧栏**。
- `config.collections`：写在站点配置里，决定**是否生成集合索引页**。
- `config.navigation`：写在站点配置里，决定**顶部入口与高亮**。

它们可以同名对齐，也可以独立变化。站点配置不覆盖页面里的 `collection`。

## 文章与独立页面

文章按日期排序，不进入文档侧栏；它的入口通常来自集合索引页或首页。独立页面不参与侧栏与分页，但必须从至少一篇文档链入。

## 检查清单

- 新增页面复用了已有 `collection` 与 `section`。
- `order` 与相邻页面保持间隔，不为了插入而整组重排。
- 文章写了 `date`，文档没有误用日期排序。
- 独立页面至少有一个文档入口。
- 页面移动后更新站内链接与外部引用。

## 相关文档

- [编写内容](/guide/authoring)
- [内容类型与路由](/guide/content-types)
- [Frontmatter 与元数据](/guide/frontmatter-fields)
- [导航与内容清单](/guide/navigation)
