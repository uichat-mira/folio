import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import {
  FolioHome,
  FolioMarkdown,
  resolveFolioCodePalette,
  useFolioAppearance,
  type FolioCodePalette,
  type FolioColorSchemePreference,
  type FolioConfig,
  type FolioDoc,
  type FolioHomeTemplate,
  type FolioVisualPreset,
} from "@uichat-mira/folio";
import config from "../folio.config";
import { createFolioThemeConfig } from "./theme-explorer-config";
import { collectFolioTokens, designTokenKind, type LiveFolioToken, type DesignTokenKind } from "./design-reference-tokens";

const PRESETS: FolioVisualPreset[] = ["pearl", "editorial", "graphite"];
const SCHEMES: FolioColorSchemePreference[] = ["system", "light", "dark"];
const PALETTES: FolioCodePalette[] = ["auto", "xuanzhi", "xuanmo", "porcelain"];
const TEMPLATES: FolioHomeTemplate[] = ["portal", "editorial"];

const CODE_EXAMPLE = [
  "~~~ts",
  "// Explicit code palettes are independent; auto adapts to preset and scheme.",
  'import { defineFolioConfig } from "@uichat-mira/folio";',
  "",
  "export default defineFolioConfig({",
  '  title: "Field Notes",',
  '  description: "A Git-native publication",',
  '  appearance: { preset: "pearl", scheme: "system", codePalette: "auto" },',
  '  home: { template: "editorial" },',
  "});",
  "~~~",
].join("\n");

function useLiveTokens(): LiveFolioToken[] {
  const [tokens, setTokens] = useState<LiveFolioToken[]>([]);
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const refresh = () => {
      cancelAnimationFrame(frame);
      // FolioApp commits root attributes in a passive effect. Sampling on the
      // next frame reads the final cascade instead of a stale selection.
      frame = requestAnimationFrame(() => setTokens(collectFolioTokens(getComputedStyle(root))));
    };
    const observer = new MutationObserver(refresh);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-folio-preset", "data-folio-theme", "data-folio-code-palette"],
    });
    refresh();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return tokens;
}

function SelectField<T extends string>({
  title, value, options, onChange,
}: {
  title: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="design-ref-control">
      <span>{title}</span>
      <select value={value} onChange={(event) => onChange(event.currentTarget.value as T)}>
        {options.map((item) =>
          <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}

function ThemeReference({ docs }: { docs: FolioDoc[] }) {
  const { appearance, effectiveScheme, isPreviewing, preview, resetPreview } = useFolioAppearance();
  const siteConfig: FolioConfig = config;
  const initialTemplate = siteConfig.home?.template ?? "portal";
  const [template, setTemplate] = useState<FolioHomeTemplate>(initialTemplate);
  const [notice, setNotice] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  const currentConfig = createFolioThemeConfig(appearance, template);

  function reset() {
    resetPreview();
    setTemplate(initialTemplate);
    setNotice("已恢复已有读者偏好与站点默认外观");
    setManualCopy(false);
  }

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(currentConfig);
      setNotice("当前配置已复制（对应 dev 源码）");
      setManualCopy(false);
    } catch {
      setNotice("剪贴板不可用，可以在下方选择文本复制");
      setManualCopy(true);
    }
  }

  return (
    <div className="design-ref-interactive">
      <div className="design-ref-lab-head">
        <div>
          <strong>Live appearance / 真实站点主题</strong>
          <p>操作的是本页正在使用的 FolioApp。请观察导航、正文、边框与下方内置首页。</p>
        </div>
        <span>实际生效 {effectiveScheme} · {appearance.preset}</span>
      </div>
      <div className="design-ref-controls" role="group" aria-label="设计系统主题实验">
        <SelectField title="Visual preset" value={appearance.preset} options={PRESETS}
          onChange={(preset) => preview({ preset })} />
        <SelectField title="Website scheme" value={appearance.scheme} options={SCHEMES}
          onChange={(scheme) => preview({ scheme })} />
        <SelectField title="Code palette" value={appearance.codePalette} options={PALETTES}
          onChange={(codePalette) => preview({ codePalette })} />
        <SelectField title="Home template" value={template} options={TEMPLATES}
          onChange={setTemplate} />
      </div>
      <div className="design-ref-actions">
        <span>{isPreviewing ? "临时预览，不改写读者的持久化偏好" : "当前使用原有站点 / 读者偏好"}</span>
        <button type="button" onClick={reset}
          disabled={!isPreviewing && template === initialTemplate}>恢复原有外观</button>
        <button type="button" className="design-ref-primary-action" onClick={() => void copy()}>
          复制配置
        </button>
      </div>
      <p className="design-ref-notice" role="status" aria-live="polite">{notice}</p>
      {manualCopy && (
        <label className="design-ref-manual-copy">
          手动复制 folio.config.ts
          <textarea readOnly value={currentConfig} rows={12}
            onFocus={(event) => event.currentTarget.select()} />
        </label>
      )}
      <div className="design-ref-preview" role="region"
        aria-label={template + " 内置首页实时预览"} tabIndex={0}>
        <FolioHome config={config} docs={docs} template={template} as="div" />
      </div>
      <p className="design-ref-footnote">
        这里渲染的是框架公开的 FolioHome，不是缩略图或模仿模板；
        只改变局部模板预览，绝不替换 Folio 官网首页。
      </p>
      <div className="design-ref-code-sample">
        <div className="design-ref-code-caption">
          <strong>FolioMarkdown / 真实代码色板</strong>
          <span>{resolveFolioCodePalette(appearance.codePalette, effectiveScheme, appearance.preset)}</span>
        </div>
        <FolioMarkdown source={CODE_EXAMPLE} className="folio-markdown design-ref-markdown" />
      </div>
    </div>
  );
}

function TokenCard({ entry }: { entry: LiveFolioToken }) {
  const color = /^(?:#|rgb\(|rgba\(|hsl\(|hsla\(|oklch\(|color\()/i.test(entry.value);
  return (
    <div className="design-ref-token" aria-label={entry.name + " " + entry.value}>
      {color && <span className="design-ref-token-color" aria-hidden="true"
        style={{ backgroundColor: "var(" + entry.name + ")" }} />}
      <span className="design-ref-token-meta">
        <code>{entry.name}</code>
        <small>{entry.value}</small>
      </span>
    </div>
  );
}

const GROUPS: { kind: DesignTokenKind; name: string; note: string }[] = [
  { kind: "semantic", name: "Semantic · 语义颜色", note: "画布、层次、正文、边界、状态与动作" },
  { kind: "code", name: "Code · 代码与语法", note: "代码表面和语法角色来自同一套公共 CSS" },
  { kind: "type", name: "Type · 字族", note: "展示、正文、等宽三种职责" },
  { kind: "scale", name: "Scale · 尺度", note: "圆角、间距、阅读框架等布局约束" },
];

function TokensReference() {
  const { appearance, effectiveScheme, preview, resetPreview } = useFolioAppearance();
  const tokens = useLiveTokens();
  const resolvedPalette = resolveFolioCodePalette(appearance.codePalette, effectiveScheme, appearance.preset);

  return (
    <div className="design-ref-interactive">
      <div className="design-ref-lab-head">
        <div>
          <strong>Live token inventory / 当前实际生效的变量</strong>
          <p>每个值都由浏览器从 Folio 的计算样式读取；源码变化后，展板自然跟着变化。</p>
        </div>
        <span>{tokens.length} 个当前变量</span>
      </div>
      <div className="design-ref-controls" role="group" aria-label="站点与代码主题组合">
        <SelectField title="Visual preset" value={appearance.preset} options={PRESETS}
          onChange={(preset) => preview({ preset })} />
        <SelectField title="Website scheme" value={appearance.scheme} options={SCHEMES}
          onChange={(scheme) => preview({ scheme })} />
        <SelectField title="Code palette" value={appearance.codePalette} options={PALETTES}
          onChange={(codePalette) => preview({ codePalette })} />
      </div>
      <div className="design-ref-actions">
        <span>页面 {effectiveScheme} / 代码 {resolvedPalette}</span>
        <button type="button" onClick={resetPreview}>恢复原有外观</button>
      </div>
      <div className="design-ref-code-sample">
        <div className="design-ref-code-caption">
          <strong>FolioMarkdown / highlight.js</strong>
          <span>{resolvedPalette} · 真实代码渲染</span>
        </div>
        <FolioMarkdown source={CODE_EXAMPLE} className="folio-markdown design-ref-markdown" />
      </div>
      {tokens.length ? GROUPS.map((group) => {
        const selected = tokens.filter((token) => designTokenKind(token.name) === group.kind);
        if (!selected.length) return null;
        return (
          <section key={group.kind} className="design-ref-token-group"
            aria-label={group.name}>
            <div className="design-ref-group-heading">
              <h3>{group.name}</h3>
              <p>{group.note} · {selected.length} tokens</p>
            </div>
            <div className="design-ref-token-grid">
              {selected.map((entry) => <TokenCard key={entry.name} entry={entry} />)}
            </div>
          </section>
        );
      }) : (
        <p className="design-ref-footnote" role="status">
          正在读取当前样式；若浏览器不支持枚举计算 Token，请参考下方源文件链接与静态语义表。
        </p>
      )}
      <p className="design-ref-footnote">
        Token 数量与十六进制值不写入文档；它们来自当前运行的 CSS，
        不是从旧设计稿复制。请勿将预览中显示的某个色值当作固定公开 API。
      </p>
    </div>
  );
}

/**
 * HTML in trusted Markdown supplies the progressive-enhancement anchor.
 * A single site-owned React portal can consume the real FolioApp Context;
 * scripts embedded in Markdown would not run reliably after React insertion.
 */
export function DesignReferenceEnhancement({ docs }: { docs: FolioDoc[] }) {
  const location = useLocation();
  const marker = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [kind, setKind] = useState<"theme" | "tokens" | null>(null);

  useEffect(() => {
    // FolioHeader intentionally renders the consumer actions in desktop and
    // mobile containers. Only the first *site-owned* marker may portal into
    // trusted Markdown, avoiding duplicated controls and competing state.
    // Do not depend on private Header class names or modify document root.
    if (document.querySelector("[data-design-reference-bridge]") !== marker.current) {
      setHost(null);
      setKind(null);
      return;
    }
    const theme = document.getElementById("design-ref-theme-slot");
    const tokens = document.getElementById("design-ref-tokens-slot");
    setHost(theme ?? tokens);
    setKind(theme ? "theme" : tokens ? "tokens" : null);
  }, [location.pathname]);

  return (
    <>
      <span ref={marker} hidden data-design-reference-bridge="" />
      {host && kind ? createPortal(
        kind === "theme" ? <ThemeReference docs={docs} /> : <TokensReference />,
        host,
      ) : null}
    </>
  );
}
