import { createRoot } from "react-dom/client";
import { FolioApp, type FolioDoc } from "@uichat-mira/folio";
import "@uichat-mira/folio/styles.css";
import docs, { roots } from "virtual:folio/content";

// No cast, no `any`, no consumer-side ambient declaration: both
// exports must be typed by Folio's installed tarball.
const content: FolioDoc[] = docs;

const container = document.getElementById("root");
if (!container) throw new Error("consumer index.html is missing #root");

// Exposed only so the browser acceptance run can prove the named export
// reached the runtime, without adding consumer-specific visual styling.
document.documentElement.dataset.folioConsumerRoots = roots.join(",");

createRoot(container).render(
  <FolioApp
    config={{
      title: "Folio 默认文档站消费者基线",
      description:
        "只安装真实 tarball 的独立 Vite + React 消费者，用于采集 Folio 默认文档 UI 基线。",
      navigation: [{ label: "文档", href: "/docs" }],
      footer: "FOL-019 · 独立消费者默认 UI 基线",
    }}
    docs={content}
    basePath={import.meta.env.BASE_URL}
  />,
);
