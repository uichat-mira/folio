import React from "react";
import ReactDOM from "react-dom/client";
import { FolioApp, type FolioDoc } from "@uichat-mira/folio";
import "@uichat-mira/folio/styles.css";
import docs from "virtual:folio/content";
import config from "../folio.config";
import { HomePage } from "./HomePage";
import "./site.css";
import "./legacy-claude-visual.css";

const content = docs as FolioDoc[];
const basePath = import.meta.env.BASE_URL;

const articleFooter = (
  <aside className="site-article-proof">
    <span>Rendered by Folio</span>
    <p>
      这篇内容来自仓库 Markdown，经由 <code>virtual:folio/content</code> 进入同一个公开运行时。
    </p>
  </aside>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FolioApp
      config={config}
      docs={content}
      basePath={basePath}
      slots={{
        home: <HomePage docs={content} basePath={basePath} />,
        articleFooter,
      }}
    />
  </React.StrictMode>,
);
