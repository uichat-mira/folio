import React from "react";
import ReactDOM from "react-dom/client";
import { FolioApp, type FolioDoc } from "@uichat-mira/folio";
import "@uichat-mira/folio/styles.css";
import docs from "virtual:folio/content";
import config from "../folio.config";
import { HomePage } from "./HomePage";
import { HeaderVersionPopover } from "./HeaderVersionPopover";
import { withFolioBaseLinks } from "./content-links";
import "./site.css";
import "./home.css";
import "./legacy-claude-visual.css";

const basePath = import.meta.env.BASE_URL;
const content = (docs as FolioDoc[]).map((doc) => ({
  ...doc,
  body: withFolioBaseLinks(doc.body, basePath),
}));

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
      ui={{ footerOnDocs: false }}
      slots={{
        headerBrand: <span className="site-header-wordmark" role="img" aria-label="Folio" />,
        home: <HomePage docs={content} />,
        articleFooter,
        headerActions: <HeaderVersionPopover />,
      }}
    />
  </React.StrictMode>,
);
