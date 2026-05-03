/** Layout limits for `/trading/terminal` split panes (used with persisted uiStore widths). */
export const TERMINAL_RESIZE = {
  /** Column split handles (watchlist / order panel). */
  handleHitPx: 8,
  /** Chart ↔ positions splitter — slightly wider so it is easier to grab above the TradingView iframe. */
  bottomHandleHitPx: 12,
  /** Minimum width of the center column (chart must stay usable). */
  chartMinWidth: 280,
  /** Minimum height of the chart stack above the bottom panel. */
  chartMinHeight: 200,
  /** Room for vertical handles + rounding when computing max watchlist/order width. */
  handlesSlack: 48,
  /** Approximate TopBar + padding so max bottom height matches real chart column (not full window). */
  topBarAndChromePx: 72,
} as const;

/** Max height for the positions/history bottom panel inside a column of `columnHeightPx` (chart + handle + panel). */
export function maxBottomPanelHeightPx(columnHeightPx: number): number {
  if (!Number.isFinite(columnHeightPx) || columnHeightPx <= 0) return 280;
  const slack = TERMINAL_RESIZE.bottomHandleHitPx + 8;
  return Math.floor(
    Math.min(
      columnHeightPx * 0.68,
      columnHeightPx - TERMINAL_RESIZE.chartMinHeight - slack,
    ),
  );
}
