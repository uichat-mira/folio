---
title: 这个站就是 Folio 的测试用例
path: /reference/site
description: 官方 reference implementation 如何在不访问 runtime 私有源码的前提下，把 Folio 的核心能力组合成完整产品站。
group: 案例
order: 1
type: page
status: live
tags:
  - Reference
  - Dogfood
  - Public API
surface: official-reference
contract: public-api-only
private_imports: 0
---

这个页面故意使用了 Folio 不认识的 Frontmatter 字段：

```yaml
surface: official-reference
contract: public-api-only
private_imports: 0
```

Folio 不会丢掉它们。未知字段会进入 `doc.data`，首页再从真实 manifest 中读取 `surface` 并显示出来。

这就是一个很小、但很具体的可扩展性证明。

## 这套案例必须满足的规则

官方站不能因为“自己人”身份获得任何隐藏接口。

它必须遵守与普通 consumer 一样的边界：

1. 运行时只从 `@uichat-mira/folio` 导入；
2. Vite 能力只从 `@uichat-mira/folio/vite` 导入；
3. 内容只从 `virtual:folio/content` 获取；
4. 品牌与交互留在 `apps/site`；
5. 不访问 `packages/folio/src/*`；
6. 生产构建必须在 GitHub Pages 的真实 `/folio/` 子路径工作。

## 它展示了哪些核心面

### Content model

当前仓库同时存在 `doc`、`article`、`project` 与 `page`。

首页上的 entry 数量、heading 数量和 tag 数量全部来自 virtual manifest，不维护第二份统计数据。

### React runtime

默认文档页继续由 `FolioApp` 渲染。

首页、header action 与文章尾部通过 slots 组合，因此 consumer 可以改变产品表达，而不 fork runtime。

### Static build

生产构建为所有 route 生成静态 HTML，同时产生 canonical、Open Graph、JSON-LD、404、sitemap 和 robots。

### Schema

仓库根目录的 schema 会随官方站一起发布到 `/folio/schemas/`，因此 schema `$id` 是真的可访问 URL，而不是装饰字段。

## 什么算失败

如果未来为了让这个官网继续演进，必须：

- 改 runtime 私有组件；
- 增加“仅官网可用”的隐藏 API；
- 在站点里复制一套内容索引；
- 绕过 Folio 的 static build 自己再写一套 route 生成器；

那就说明 Folio 的公共边界还不够好。

官方案例的责任不是永远证明 Folio 正确，而是尽早把这种不足暴露出来。
