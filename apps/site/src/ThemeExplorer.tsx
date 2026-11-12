import { useEffect, useState } from "react";
import {
  FolioHome,
  FolioMarkdown,
  useFolioAppearance,
  type FolioCodePalette,
  type FolioColorSchemePreference,
  type FolioDoc,
  type FolioConfig,
  type FolioHomeTemplate,
  type FolioVisualPreset,
} from "@uichat-mira/folio";
import config from "../folio.config";
import { createFolioThemeConfig } from "./theme-explorer-config";

const presets: { value: FolioVisualPreset; name: string }[] = [
  { value: "pearl", name: "Pearl · 珍珠白" },
  { value: "editorial", name: "Editorial · 编辑风" },
  { value: "graphite", name: "Graphite · 石墨" },
];

const schemes: { value: FolioColorSchemePreference; name: string }[] = [
  { value: "system", name: "System · 跟随系统" },
  { value: "light", name: "Light · 浅色" },
  { value: "dark", name: "Dark · 深色" },
];

const palettes: { value: FolioCodePalette; name: string }[] = [
  { value: "auto", name: "Auto · 随明暗" },
  { value: "xuanzhi", name: "Xuanzhi · 宣纸" },
  { value: "xuanmo", name: "Xuanmo · 玄墨" },
];

const templates: { value: FolioHomeTemplate; name: string }[] = [
  { value: "portal", name: "Portal · 门户" },
  { value: "editorial", name: "Editorial · 刊物" },
];

/**
 * This enhancement is intentionally absent from the static home and the
 * first client render. Static HomePage stays useful without JavaScript;
 * once FolioApp mounts, its public appearance Context owns all changes.
 */
export function ThemeExplorerGate({ docs }: { docs: FolioDoc[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <ThemeExplorer docs={docs} /> : null;
}

function ThemeExplorer({ docs }: { docs: FolioDoc[] }) {
  const { appearance, effectiveScheme, isPreviewing, preview, resetPreview } =
    useFolioAppearance();
  const siteConfig: FolioConfig = config;
  const initialTemplate: FolioHomeTemplate = siteConfig.home?.template ?? "portal";
  const [template, setTemplate] = useState<FolioHomeTemplate>(initialTemplate);
  const [copyMessage, setCopyMessage] = useState("");
  const [manualCopy, setManualCopy] = useState(false);

  const configText = createFolioThemeConfig(appearance, template);
  // Render the actual Markdown pipeline (including Folio's syntax tokens), not
  // a hand-painted code snippet. This source is also exactly what users copy.
  const markdownSource = "### folio.config.ts\n\n" +
    "```ts\n" + configText + "\n```";

  function changeAppearance(value: Parameters<typeof preview>[0]) {
    preview(value);
    setCopyMessage("");
    setManualCopy(false);
  }

  function changeTemplate(next: FolioHomeTemplate) {
    setTemplate(next);
    setCopyMessage("");
    setManualCopy(false);
  }

  function restoreDefaults() {
    // resetPreview() restores the existing explicit reader choice if any.
    // It never writes a new light/dark setting into localStorage.
    resetPreview();
    setTemplate(initialTemplate);
    setCopyMessage("已恢复站点预设和读者原有明暗偏好");
    setManualCopy(false);
  }

  async function copyConfig() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(configText);
      setCopyMessage("配置已复制，可粘贴到 folio.config.ts（dev API）");
      setManualCopy(false);
    } catch {
      setManualCopy(true);
      setCopyMessage("无法写入剪贴板，请从下方文本框手动复制");
    }
  }

  return (
    <div className="portal-explorer" aria-labelledby="portal-explorer-title">
      <div className="portal-explorer__intro">
        <div>
          <p className="portal-section__index">EXPLORE / 4 INDEPENDENT CONTROLS</p>
          <h3 id="portal-explorer-title">把喜欢的气质，调出来。</h3>
          <p>外观立即作用于整个站点；首页模板只在下方预览，不替换 Folio 官网。</p>
        </div>
        <span className="portal-explorer__availability">DEV API · 尚未发布 npm 0.1.1</span>
      </div>

      <div className="portal-explorer__controls" role="group" aria-label="主题组合控制">
        <label className="portal-explorer__control" htmlFor="portal-explorer-preset">
          <span>Preset <small>外观预设</small></span>
          <select id="portal-explorer-preset" value={appearance.preset}
            onChange={(event) => changeAppearance({ preset: event.currentTarget.value as FolioVisualPreset })}>
            {presets.map((item) =>
              <option key={item.value} value={item.value}>{item.name}</option>)}
          </select>
        </label>
        <label className="portal-explorer__control" htmlFor="portal-explorer-scheme">
          <span>Scheme <small>显示模式</small></span>
          <select id="portal-explorer-scheme" value={appearance.scheme}
            onChange={(event) => changeAppearance({ scheme: event.currentTarget.value as FolioColorSchemePreference })}>
            {schemes.map((item) =>
              <option key={item.value} value={item.value}>{item.name}</option>)}
          </select>
        </label>
        <label className="portal-explorer__control" htmlFor="portal-explorer-palette">
          <span>Code Palette <small>代码色板</small></span>
          <select id="portal-explorer-palette" value={appearance.codePalette}
            onChange={(event) => changeAppearance({ codePalette: event.currentTarget.value as FolioCodePalette })}>
            {palettes.map((item) =>
              <option key={item.value} value={item.value}>{item.name}</option>)}
          </select>
        </label>
        <label className="portal-explorer__control" htmlFor="portal-explorer-template">
          <span>Home Template <small>首页模板</small></span>
          <select id="portal-explorer-template" value={template}
            onChange={(event) => changeTemplate(event.currentTarget.value as FolioHomeTemplate)}>
            {templates.map((item) =>
              <option key={item.value} value={item.value}>{item.name}</option>)}
          </select>
        </label>
      </div>

      <div className="portal-explorer__actions">
        <span className="portal-explorer__effective">
          当前生效：{effectiveScheme === "dark" ? "Dark" : "Light"} · {appearance.preset}
          {isPreviewing ? " · 临时预览" : ""}
        </span>
        <button type="button" className="portal-explorer__button portal-explorer__button--reset"
          onClick={restoreDefaults} disabled={!isPreviewing && template === initialTemplate}>
          恢复默认
        </button>
        <button type="button" className="portal-explorer__button portal-explorer__button--copy"
          onClick={() => void copyConfig()}>
          复制当前配置
        </button>
      </div>
      <p className="portal-explorer__notice" role="status" aria-live="polite">{copyMessage}</p>

      <div className="portal-explorer__results">
        <section className="portal-explorer__result" aria-labelledby="portal-explorer-template-title">
          <div className="portal-explorer__result-heading">
            <h4 id="portal-explorer-template-title">真实首页模板</h4>
            <span>{template.toUpperCase()} / PUBLIC FOLIO HOME</span>
          </div>
          <p>以下直接渲染框架的 FolioHome，使用本站真实文章与路由。</p>
          <div className="portal-explorer__viewport" aria-label={template + " 首页模板预览"} role="region" tabIndex={0}>
            <FolioHome config={config} docs={docs} template={template} as="div" />
          </div>
        </section>
        <section className="portal-explorer__result" aria-labelledby="portal-explorer-code-title">
          <div className="portal-explorer__result-heading">
            <h4 id="portal-explorer-code-title">真实 Markdown / 代码色板</h4>
            <span>{appearance.codePalette.toUpperCase()} / FOLIO MARKDOWN</span>
          </div>
          <p>渲染与真实文章共用 FolioMarkdown，代码色板独立于网站明暗。</p>
          <FolioMarkdown source={markdownSource}
            className="folio-markdown portal-explorer__markdown" />
          {manualCopy ? (
            <label className="portal-explorer__manual-copy">
              手动复制配置
              <textarea readOnly rows={11} value={configText}
                onFocus={(event) => event.currentTarget.select()} />
            </label>
          ) : null}
        </section>
      </div>
    </div>
  );
}
