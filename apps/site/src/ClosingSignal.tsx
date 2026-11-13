/** A glimpse of an orbital system extending far beyond the closing panel. */
export function ClosingSignal() {
  return (
    <svg
      className="portal-closing__signal"
      viewBox="0 0 1600 520"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* The centers deliberately sit near or beyond the viewport edge.
          Only pieces of the much larger rings are allowed into the frame. */}
      <g transform="translate(1500 130)">
        <g className="portal-closing__orbit portal-closing__orbit--level">
          <ellipse className="portal-closing__orbit-line" rx="780" ry="228" />
          <ellipse className="portal-closing__orbit-glint" rx="780" ry="228" pathLength="1000" />
        </g>
      </g>
      <g transform="translate(1480 295)">
        <g className="portal-closing__orbit portal-closing__orbit--rising">
          <ellipse className="portal-closing__orbit-line" rx="690" ry="185" />
          <ellipse className="portal-closing__orbit-glint" rx="690" ry="185" pathLength="1000" />
        </g>
      </g>
      <g transform="translate(1710 80)">
        <g className="portal-closing__orbit portal-closing__orbit--falling">
          <ellipse className="portal-closing__orbit-line" rx="940" ry="265" />
          <ellipse className="portal-closing__orbit-glint" rx="940" ry="265" pathLength="1000" />
        </g>
      </g>
    </svg>
  );
}
