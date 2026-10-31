import { createRoot } from "react-dom/client";
import { FolioApp, type FolioDoc } from "@uichat-mira/folio";
import "@uichat-mira/folio/styles.css";
import docs from "virtual:folio/content";

const container = document.getElementById("root");
if (!container) throw new Error("fixture index.html is missing #root");

// 标记 React 真正完成了一次渲染：--dump-dom 的 <html> 属性据此区分
// “静态预渲染 HTML 仍在”和“React 已接管”。
document.documentElement.setAttribute("data-folio-react", "rendered");

createRoot(container).render(
  <FolioApp
    config={{
      title: "FOL-008 Navigation Fixture",
      description: "Static vs React navigation parity corpus.",
      navigation: [
        { label: "入门", href: "/docs/guide/intro" },
        { label: "运行时", href: "/docs/guide/second" },
        { label: "静态发布", href: "/docs/guide/third" },
      ],
    }}
    docs={docs as FolioDoc[]}
    basePath={import.meta.env.BASE_URL}
    ui={{ search: false, theme: false, share: false }}
  />,
);
