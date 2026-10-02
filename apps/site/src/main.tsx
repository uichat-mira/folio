import React from "react";
import ReactDOM from "react-dom/client";
import { FolioApp, type FolioDoc } from "@uichat-mira/folio";
import "@uichat-mira/folio/styles.css";
import docs from "virtual:folio/content";
import config from "../folio.config";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FolioApp
      config={config}
      docs={docs as FolioDoc[]}
      basePath={import.meta.env.BASE_URL}
    />
  </React.StrictMode>,
);
