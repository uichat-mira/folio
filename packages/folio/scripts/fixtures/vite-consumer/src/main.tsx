import { createRoot } from "react-dom/client";
import "@uichat-mira/folio/styles.css";
import { defineFolioConfig } from "@uichat-mira/folio";
import docs, { roots } from "virtual:folio/content";

const config = defineFolioConfig({
  title: "Folio Vite consumer fixture",
  description:
    "Standalone consumer that resolves virtual:folio/content from the installed package.",
});

const container = document.getElementById("root");
if (!container) throw new Error("fixture index.html is missing #root");

createRoot(container).render(
  <main>
    <h1>{config.title}</h1>
    <p>{`docs=${docs.length} roots=${roots.join(",")}`}</p>
    <ul>
      {docs.map((doc) => (
        <li key={doc.path}>
          <strong>{doc.title}</strong>
          <span>{doc.description}</span>
          <pre>{doc.body}</pre>
        </li>
      ))}
    </ul>
  </main>,
);
