/**
 * Shared money / percentage / P&L formatting — the single source of truth.
 * Was previously duplicated inline (toLocaleString with 2-digit options) in
 * 11+ files, drifting in style between screens.
 */
import { vantage } from '../theme/vantageTheme';

/** "1,234.56" — account-currency amount without symbol. */
export function formatMoney(value, { dash = '—' } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return dash;
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "+1,234.56" / "−1,234.56" — signed amount (true minus sign). */
export function formatSignedMoney(value, { dash = '—' } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return dash;
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "+1.23%" — signed percentage. */
export function formatPct(value, { digits = 2, dash = '—' } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return dash;
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

/** Theme color for a P&L value: up-green / down-red / muted for null. */
export function pnlColor(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return vantage.textMuted;
  return n >= 0 ? vantage.up : vantage.down;
}
