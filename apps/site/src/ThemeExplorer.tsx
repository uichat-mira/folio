import { useEffect, useState } from "react";
import { useHref } from "react-router-dom";
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
import { ThemeSelect } from "./ThemeSelect";

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
  { value: "auto", name: "Auto · 随主题与明暗" },
  { value: "xuanzhi", name: "Xuanzhi · 宣纸" },
  { value: "xuanmo", name: "Xuanmo · 玄墨" },
  { value: "porcelain", name: "Porcelain · 瓷白" },
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
  // Do not mount the configuration panel or its iframe on phone screens.
  // A lightweight, SSR-friendly SVG illustrates this section instead.
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 701px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return desktop ? <ThemeExplorer docs={docs} /> : null;
}

function ThemeExplorer({ docs }: { docs: FolioDoc[] }) {
  const { appearance, isPreviewing, preview, resetPreview } =
    useFolioAppearance();
  const siteConfig: FolioConfig = config;
  const initialTemplate: FolioHomeTemplate = siteConfig.home?.template ?? "portal";
  const [template, setTemplate] = useState<FolioHomeTemplate>(initialTemplate);
  const [copied, setCopied] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);

  const configText = createFolioThemeConfig(appearance, template);
  // The iframe has its own real 390px viewport so Folio's @media rules
  // respond as they would on a phone, instead of to the parent desktop.
  const homeHref = useHref("/");
  const phoneQuery = new URLSearchParams({
    "folio-preview": "mobile",
    preset: appearance.preset,
    scheme: appearance.scheme,
    codePalette: appearance.codePalette,
    template,
  });
  const phoneSrc = homeHref + "?" + phoneQuery.toString();
  // Render the actual Markdown pipeline (including Folio's syntax tokens), not
  // a hand-painted code snippet. This source is also exactly what users copy.
  const markdownSource = "```ts\n" + configText + "\n```";

  function changeAppearance(value: Parameters<typeof preview>[0]) {
    preview(value);
    setCopied(false);
    setManualCopy(false);
  }

  function changeTemplate(next: FolioHomeTemplate) {
    setTemplate(next);
    setCopied(false);
    setManualCopy(false);
  }

  function restoreDefaults() {
    // resetPreview() restores the existing explicit reader choice if any.
    // It never writes a new light/dark setting into localStorage.
    resetPreview();
    setTemplate(initialTemplate);
    setCopied(false);
    setManualCopy(false);
  }

  async function copyConfig() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(configText);
      setCopied(true);
      setManualCopy(false);
    } catch {
      setManualCopy(true);
      setCopied(false);
    }
  }

  return (
    <div className="portal-explorer" aria-labelledby="portal-explorer-title">
      <div className="portal-explorer__intro">
        <div>
          <p className="portal-section__index">THEME LAB</p>
          <h3 id="portal-explorer-title">把你的风格，调出来。</h3>
          <p className="portal-explorer__description">Folio 精选了几套视觉预设，让你的内容拥有自己的气质。</p>
        </div>
      </div>

      <div className="portal-explorer__studio">
        <div className="portal-explorer__settings">
          <div className="portal-explorer__controls" role="group" aria-label="主题组合控制">
            <ThemeSelect id="portal-explorer-preset" label="Preset" hint="外观预设"
              value={appearance.preset} options={presets}
              onChange={(preset) => changeAppearance({ preset })} />
            <ThemeSelect id="portal-explorer-scheme" label="Scheme" hint="显示模式"
              value={appearance.scheme} options={schemes}
              onChange={(scheme) => changeAppearance({ scheme })} />
            <ThemeSelect id="portal-explorer-palette" label="Code Palette" hint="代码色板"
              value={appearance.codePalette} options={palettes}
              onChange={(codePalette) => changeAppearance({ codePalette })} />
            <ThemeSelect id="portal-explorer-template" label="Home Template" hint="首页模板"
              value={template} options={templates}
              onChange={changeTemplate} />
          </div>

          <div className="portal-explorer__actions">
            <button type="button" className="portal-explorer__button portal-explorer__button--reset"
              onClick={restoreDefaults} disabled={!isPreviewing && template === initialTemplate}>
              恢复默认
            </button>
            <button type="button" className="portal-explorer__button portal-explorer__button--copy"
              onClick={() => void copyConfig()}>
              {copied ? "已复制" : "复制当前配置"}
            </button>
          </div>
          <section className="portal-explorer__code-panel" aria-label="当前生成的配置及代码高亮">
            <h5>folio.config.ts</h5>
            <FolioMarkdown source={markdownSource}
              className="folio-markdown portal-explorer__markdown" />
          </section>
          {manualCopy ? (
            <label className="portal-explorer__manual-copy">
              手动复制配置
              <textarea readOnly rows={11} value={configText}
                onFocus={(event) => event.currentTarget.select()} />
            </label>
          ) : null}
        </div>
        <div className="portal-explorer__device-pane" aria-label="手机外观预览">
          <div className="portal-explorer__phone">
            <div className="portal-explorer__phone-top" aria-hidden="true"><span /></div>
            <iframe
              title={template === "editorial" ? "Editorial 手机预览" : "Portal 手机预览"}
              className="portal-explorer__phone-screen"
              src={phoneSrc}
              loading="lazy"
            />
            <div className="portal-explorer__phone-bottom" aria-hidden="true"><span /></div>
          </div>
        </div>
      </div>
    </div>
  );
}


/** Dedicated iframe surface: same FolioApp + Router + CSS, but a real mobile viewport. */
export function ThemePreviewHome({ docs, search }: { docs: FolioDoc[]; search: string }) {
  const params = new URLSearchParams(search);
  // Query strings are user-editable: accept only values from public contracts.
  const preset = presets.find((item) => item.value === params.get("preset"))?.value ?? "pearl";
  const scheme = schemes.find((item) => item.value === params.get("scheme"))?.value ?? "system";
  const codePalette = palettes.find((item) => item.value === params.get("codePalette"))?.value ?? "auto";
  const template = templates.find((item) => item.value === params.get("template"))?.value ?? "portal";
  const { preview } = useFolioAppearance();

  useEffect(() => {
    // The iframe is a separate document. This uses Folio's only appearance
    // controller and never touches the reader's persisted preference.
    preview({ preset, scheme, codePalette });
  }, [preset, scheme, codePalette, preview]);

  return (
    <div className="portal-explorer__phone-content">
      <FolioHome config={config} docs={docs} template={template} as="div" />
    </div>
  );
}
