---
title: 安装真实 tarball
description: 独立消费者如何只依赖 npm tarball 安装 Folio 并启动默认文档站。
collection: 消费者验收指南
section: 开始
order: 1
---

本页属于 FOL-014 的独立消费者验收场景。它完全运行在一个临时目录里，唯一的 Folio
来源是 `npm pack` 打出的 `.tgz`，没有 workspace symlink、没有仓库源码路径、也没有
官方站点的品牌样式。

## 安装步骤

安装顺序与真实消费者一致：先取到 tarball，再让 npm 解析 peer 依赖。

```bash
npm install ./uichat-mira-folio-0.1.0.tgz
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom
```

安装完成后 `node_modules/@uichat-mira/folio` 是一个真实的解包目录，`react`、
`react-dom`、`react-router-dom`、`vite` 由 peer 依赖自动补齐。

## 三个公开入口

消费者只需要接触三个公开入口，它们都不依赖仓库内部结构：

| 入口 | 用途 | 本页验证方式 |
| --- | --- | --- |
| `@uichat-mira/folio` | `FolioApp`、类型与配置助手 | `src/main.tsx` 直接导入 |
| `@uichat-mira/folio/vite` | 内容发现与虚拟模块 | `vite.config.ts` 注册插件 |
| `@uichat-mira/folio/styles.css` | 默认整站样式 | 入口一次性引入 |

### 为什么不用官网样式

官方站点 `apps/site` 在默认样式之外还叠加了 `site.css`、`showcase.css` 与
`legacy-claude-visual.css`。用官网截图判断默认 UI，会把宿主品牌层的效果误记到包里，
所以本次验收刻意不引入这三份样式。

## 下一步

安装完成后，默认界面由 `FolioApp` 提供：顶部导航、侧栏文档目录、正文、本页目录与
上一篇/下一篇分页。继续阅读下一篇以查看实际渲染结果。
