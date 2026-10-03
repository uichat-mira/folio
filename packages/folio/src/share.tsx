import { useState } from "react";

export type FolioShareButtonProps = {
  title: string;
  text?: string;
  className?: string;
  compact?: boolean;
};

export function FolioShareButton({
  title,
  text,
  className = "folio-share-button",
  compact = false,
}: FolioShareButtonProps) {
  const [label, setLabel] = useState("分享");

  async function share() {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title,
          text: text || title,
          url,
        });
        setLabel("已分享");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setLabel("链接已复制");
      } else {
        const input = document.createElement("textarea");
        input.value = url;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
        setLabel("链接已复制");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLabel("分享失败");
    }

    window.setTimeout(() => setLabel("分享"), 1800);
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => void share()}
      aria-label={label}
      title={label}
    >
      {compact ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="18" cy="5" r="2.5" />
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="19" r="2.5" />
          <path d="m8.2 10.8 7.5-4.3M8.2 13.2l7.5 4.3" />
        </svg>
      ) : label}
    </button>
  );
}
