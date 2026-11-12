/**
 * Static SVG illustration for the small-screen Design section.
 * Every color is a Folio semantic token; the composition is not a second theme.
 * CSS adds restrained motion and disables it for reduced-motion preferences.
 */
export function DesignMobileMotion() {
  return (
    <div className="portal-design__mobile-art">
      <svg
        className="portal-design__motion-svg"
        viewBox="0 0 360 254"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-labelledby="folio-mobile-design-title folio-mobile-design-desc"
      >
        <title id="folio-mobile-design-title">Folio 主题与排版的组合</title>
        <desc id="folio-mobile-design-desc">
          三个语义色块沿着轨迹汇入一个层叠的内容页面，页面的标题、文字和内容卡片随之轻微浮动。
        </desc>
        <defs>
          <linearGradient id="folio-mobile-paper" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--site-canvas)" />
            <stop offset="1" stopColor="var(--site-surface-soft)" />
          </linearGradient>
        </defs>

        <g className="portal-design__motion-orbit" fill="none" stroke="var(--site-hairline)" strokeWidth="1.5">
          <path d="M24 120 C58 120 62 64 127 75 S191 130 219 120" strokeDasharray="4 7" />
          <path d="M31 180 C91 180 124 202 192 193" strokeDasharray="4 7" />
        </g>

        <g className="portal-design__motion-tokens" aria-hidden="true">
          <circle className="portal-design__motion-token portal-design__motion-token--one" cx="45" cy="74" r="17" fill="var(--site-primary)" />
          <circle className="portal-design__motion-token portal-design__motion-token--two" cx="94" cy="110" r="13" fill="var(--site-accent-teal)" />
          <circle className="portal-design__motion-token portal-design__motion-token--three" cx="48" cy="164" r="10" fill="var(--site-ink)" />
          <circle cx="44" cy="74" r="4" fill="var(--site-on-primary)" opacity=".85" />
        </g>

        <g className="portal-design__motion-sheet portal-design__motion-sheet--rear" aria-hidden="true">
          <rect x="159" y="27" width="151" height="205" rx="10" fill="var(--site-surface-card)" stroke="var(--site-hairline)" />
          <rect x="172" y="43" width="73" height="7" rx="3.5" fill="var(--site-muted-soft)" opacity=".7" />
          <rect x="172" y="59" width="111" height="5" rx="2.5" fill="var(--site-muted-soft)" opacity=".55" />
        </g>
        <g className="portal-design__motion-sheet portal-design__motion-sheet--mid" aria-hidden="true">
          <rect x="143" y="17" width="151" height="205" rx="10" fill="var(--site-surface-soft)" stroke="var(--site-hairline)" />
          <rect x="158" y="34" width="49" height="7" rx="3.5" fill="var(--site-primary)" opacity=".55" />
          <rect x="158" y="52" width="95" height="5" rx="2.5" fill="var(--site-muted-soft)" opacity=".6" />
        </g>

        <g className="portal-design__motion-sheet portal-design__motion-sheet--front">
          <rect x="124" y="12" width="158" height="216" rx="10" fill="url(#folio-mobile-paper)" stroke="var(--site-hairline)" strokeWidth="1.3" />
          <rect x="139" y="27" width="28" height="5" rx="2.5" fill="var(--site-primary)" />
          <rect x="238" y="27" width="28" height="4" rx="2" fill="var(--site-muted-soft)" opacity=".65" />
          <path d="M139 43 H266" stroke="var(--site-hairline)" />
          <rect x="139" y="55" width="94" height="11" rx="2" fill="var(--site-ink)" />
          <rect x="139" y="73" width="72" height="8" rx="2" fill="var(--site-ink)" opacity=".8" />
          <rect x="139" y="92" width="115" height="4" rx="2" fill="var(--site-muted-soft)" />
          <rect x="139" y="101" width="127" height="4" rx="2" fill="var(--site-muted-soft)" opacity=".75" />
          <rect x="139" y="110" width="85" height="4" rx="2" fill="var(--site-muted-soft)" opacity=".6" />
          <g className="portal-design__motion-accent">
            <rect x="139" y="129" width="127" height="58" rx="4" fill="var(--site-accent-teal)" opacity=".16" />
            <rect x="150" y="140" width="39" height="36" rx="2" fill="var(--site-accent-teal)" opacity=".88" />
            <rect x="198" y="142" width="55" height="5" rx="2.5" fill="var(--site-ink)" />
            <rect x="198" y="152" width="47" height="4" rx="2" fill="var(--site-muted-soft)" />
            <rect x="198" y="161" width="36" height="4" rx="2" fill="var(--site-muted-soft)" />
          </g>
          <path d="M139 200 H266" stroke="var(--site-hairline)" />
          <rect x="139" y="208" width="49" height="5" rx="2.5" fill="var(--site-primary)" />
          <rect x="240" y="208" width="26" height="4" rx="2" fill="var(--site-muted-soft)" />
        </g>

        <g className="portal-design__motion-spark" fill="var(--site-primary)" aria-hidden="true">
          <path d="M313 78l4 8 8 4-8 4-4 8-4-8-8-4 8-4z" opacity=".85" />
          <circle cx="312" cy="175" r="3" opacity=".65" />
          <circle cx="85" cy="210" r="2.5" opacity=".75" />
        </g>
      </svg>
      <p className="portal-design__mobile-art-caption">
        同一套设计秩序，不止一种表达。
      </p>
    </div>
  );
}
