/**
 * Client-side trade history statement PDF (landscape A4, tabular layout).
 * Uses dynamic import so jspdf is not loaded until export.
 */

export type TradeStatementRow = {
  close_time?: string | null;
  open_time?: string | null;
  opened_at?: string | null;
  symbol: string;
  side: string;
  lots: number;
  open_price?: number | null;
  close_price?: number | null;
  entry_price?: number | null;
  exit_price?: number | null;
  pnl: number;
  close_reason?: string | null;
  commission?: number | null;
  swap?: number | null;
};

function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function exitReasonText(reason: string | null | undefined): string {
  const r = (reason || 'manual').toLowerCase();
  if (r === 'sl' || r === 'stop_loss') return 'Stop loss';
  if (r === 'tp' || r === 'take_profit') return 'Take profit';
  if (r === 'manual') return 'Manual close';
  if (r === 'copy_close' || r === 'copy') return 'Copy close';
  if (r === 'admin') return 'Admin';
  return r.replace(/_/g, ' ');
}

function priceDigits(symbol: string): number {
  const s = symbol.toUpperCase();
  if (/JPY$/.test(s)) return 3;
  if (['XAUUSD', 'XAGUSD', 'USOIL', 'BTCUSD', 'ETHUSD', 'LTCUSD', 'SOLUSD'].includes(s)) return 2;
  if (['US30', 'US500', 'NAS100', 'UK100', 'GER40'].includes(s)) return 1;
  if (s === 'XRPUSD') return 4;
  return 5;
}

function formatPrice(symbol: string, v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return 'â€”';
  return v.toFixed(priceDigits(symbol));
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return 'â€”';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export type TradeStatementMeta = {
  /** Shown under title, e.g. account or user hint */
  subtitle?: string;
};

export async function downloadTradeStatementPdf(
  trades: TradeStatementRow[],
  meta?: TradeStatementMeta,
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 16;

  doc.setFillColor(41, 98, 255);
  doc.rect(0, 0, pageW, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ProlineMarkets', margin, 7);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(16);
  doc.text('Trade history statement', margin, y);
  y += 8;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(`Generated: ${formatWhen(new Date().toISOString())} (local time)`, margin, y);
  y += 5;
  doc.text(`Closed trades listed: ${trades.length}`, margin, y);
  y += 4;
  if (meta?.subtitle) {
    doc.text(meta.subtitle, margin, y);
    y += 5;
  }

  const totalPnl = trades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  const totalComm = trades.reduce((s, t) => s + (Number(t.commission) || 0), 0);
  const totalSwap = trades.reduce((s, t) => s + (Number(t.swap) || 0), 0);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(8);
  doc.text(`Total realized P&L: ${fmtUsd(totalPnl)}`, margin, y);
  y += 4;
  if (totalComm !== 0 || totalSwap !== 0) {
    doc.text(`Commission (sum): ${fmtUsd(totalComm)}  Â·  Swap (sum): ${fmtUsd(totalSwap)}`, margin, y);
    y += 4;
  }

  y += 2;

  const body = trades.map((t) => {
    const openPx =
      t.open_price != null
        ? Number(t.open_price)
        : t.entry_price != null
          ? Number(t.entry_price)
          : null;
    const closePx =
      t.close_price != null
        ? Number(t.close_price)
        : t.exit_price != null
          ? Number(t.exit_price)
          : null;
    const closed = t.close_time || t.open_time || t.opened_at;
    const opened = t.open_time || t.opened_at;
    return [
      formatWhen(closed ?? undefined),
      formatWhen(opened ?? undefined),
      t.symbol,
      String(t.side || '').toUpperCase(),
      String(t.lots),
      formatPrice(t.symbol, openPx),
      formatPrice(t.symbol, closePx),
      exitReasonText(t.close_reason),
      fmtUsd(Number(t.pnl) || 0),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [
      [
        'Closed',
        'Opened',
        'Symbol',
        'Side',
        'Lots',
        'Open price',
        'Close price',
        'Exit',
        'P&L (USD)',
      ],
    ],
    body,
    foot: [
      [
        {
          content: 'Totals',
          colSpan: 8,
          styles: { fontStyle: 'bold', halign: 'right', textColor: [30, 30, 30] },
        },
        {
          content: fmtUsd(totalPnl),
          styles: { fontStyle: 'bold', halign: 'right', textColor: totalPnl >= 0 ? [0, 120, 80] : [180, 0, 50] },
        },
      ],
    ],
    showFoot: 'lastPage',
    theme: 'striped',
    headStyles: {
      fillColor: [41, 98, 255],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2,
    },
    bodyStyles: { fontSize: 7, cellPadding: 1.5, textColor: [40, 40, 40] },
    footStyles: { fillColor: [245, 245, 245], fontSize: 8 },
    alternateRowStyles: { fillColor: [252, 252, 252] },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 32 },
      2: { cellWidth: 22 },
      3: { cellWidth: 14 },
      4: { cellWidth: 14, halign: 'right' },
      5: { cellWidth: 24, halign: 'right', font: 'courier' },
      6: { cellWidth: 24, halign: 'right', font: 'courier' },
      7: { cellWidth: 28 },
      8: { cellWidth: 26, halign: 'right', font: 'courier' },
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 140);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pageW - margin - 28,
        doc.internal.pageSize.getHeight() - 6,
      );
      doc.text(
        'ProlineMarkets â€” for information only. Not tax or legal advice.',
        margin,
        doc.internal.pageSize.getHeight() - 6,
      );
    },
  });

  const safeDate = new Date().toISOString().slice(0, 10);
  doc.save(`ProlineMarkets-trade-statement-${safeDate}.pdf`);
}
