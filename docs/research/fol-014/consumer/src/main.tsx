import { createRoot } from "react-dom/client";
import { FolioApp, type FolioDoc } from "@uichat-mira/folio";
import "@uichat-mira/folio/styles.css";
import docs, { roots } from "virtual:folio/content";

// No cast, no `any`: the default export is typed by the consumer-side
// declaration in `types/virtual-folio.d.ts`. `roots` is used as well so the
// named export of the virtual module is covered by the same type check.
const content: FolioDoc[] = docs;

const container = document.getElementById("root");
if (!container) throw new Error("consumer index.html is missing #root");

// Exposed only so the browser acceptance run can prove the named export
// reached the runtime, without adding consumer-specific visual styling.
document.documentElement.dataset.folioConsumerRoots = roots.join(",");

createRoot(container).render(
  <FolioApp
    config={{
      title: "Folio 默认文档站消费者验收",
      description:
        "只安装真实 tarball 的独立 Vite + React 消费者，用于验收 Folio 默认文档 UI。",
      navigation: [{ label: "文档", href: "/docs" }],
      footer: "FOL-014 · 独立消费者默认 UI 验收",
    }}
    docs={content}
    basePath={import.meta.env.BASE_URL}
  />,
);
