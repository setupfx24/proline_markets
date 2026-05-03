import { OHLCV, ChartTheme, Viewport } from '../core/types';

export class CandlestickRenderer {
  constructor(private ctx: CanvasRenderingContext2D, private theme: ChartTheme) {}

  render(
    data: OHLCV[],
    viewport: Viewport,
    candleWidth: number,
    candleGap: number,
    chartHeight: number
  ) {
    const ctx = this.ctx;
    const priceRange = viewport.priceMax - viewport.priceMin;
    if (priceRange <= 0) return;

    const priceToY = (price: number) =>
      chartHeight - ((price - viewport.priceMin) / priceRange) * chartHeight;

    for (let i = 0; i < data.length; i++) {
      const bar = data[i];
      const x = i * (candleWidth + candleGap);
      const centerX = x + candleWidth / 2;

      const isBull = bar.close >= bar.open;
      const bodyTop = priceToY(isBull ? bar.close : bar.open);
      const bodyBottom = priceToY(isBull ? bar.open : bar.close);
      const bodyHeight = Math.max(1, bodyBottom - bodyTop);

      const wickTop = priceToY(bar.high);
      const wickBottom = priceToY(bar.low);

      // Wick
      ctx.strokeStyle = isBull ? this.theme.bullWick : this.theme.bearWick;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX, wickTop);
      ctx.lineTo(centerX, wickBottom);
      ctx.stroke();

      // Body
      ctx.fillStyle = isBull ? this.theme.bullCandle : this.theme.bearCandle;
      ctx.fillRect(x, bodyTop, candleWidth, bodyHeight);

      if (!isBull) {
        ctx.strokeStyle = this.theme.bearCandle;
        ctx.strokeRect(x, bodyTop, candleWidth, bodyHeight);
      }
    }
  }
}
