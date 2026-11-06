import { FolioUtilityPopover } from "@uichat-mira/folio";

// A real release link is used for the example. The current site is a dev
// showcase, so this is the published package version, not a switchable runtime.
export function HeaderVersionPopover() {
  return (
    <FolioUtilityPopover
      label="Folio 发布版本与资源"
      className="site-version-popover"
      trigger={
        <>
          <span className="site-version-popover__caption">v0.1.1</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </>
      }
    >
      <div className="site-version-popover__current" aria-label="当前已发布版本">
        <span>当前版本</span>
        <strong>v0.1.1</strong>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
      </div>
      <a href="https://www.npmjs.com/package/@uichat-mira/folio/v/0.1.0" target="_blank" rel="noreferrer">
        <span>v0.1.0 · 早期版本</span>
        <span aria-hidden="true">↗</span>
      </a>
      <a href="https://github.com/uichat-mira/folio/releases/tag/folio-v0.1.1" target="_blank" rel="noreferrer">
        <span>版本发布页</span>
        <span aria-hidden="true">↗</span>
      </a>
      <a href="https://github.com/uichat-mira/folio/releases" target="_blank" rel="noreferrer">
        <span>更新记录</span>
        <span aria-hidden="true">↗</span>
      </a>
      <a href="https://github.com/uichat-mira/folio/issues" target="_blank" rel="noreferrer">
        <span>参与贡献</span>
        <span aria-hidden="true">↗</span>
      </a>
    </FolioUtilityPopover>
  );
}
