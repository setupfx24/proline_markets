import { OHLCV, Viewport } from '../core/types';

export class LineRenderer {
  constructor(private ctx: CanvasRenderingContext2D) {}

  render(
    data: OHLCV[],
    viewport: Viewport,
    candleWidth: number,
    candleGap: number,
    chartHeight: number,
    color: string
  ) {
    const ctx = this.ctx;
    const priceRange = viewport.priceMax - viewport.priceMin;
    if (priceRange <= 0 || data.length < 2) return;

    const priceToY = (price: number) =>
      chartHeight - ((price - viewport.priceMin) / priceRange) * chartHeight;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();

    for (let i = 0; i < data.length; i++) {
      const x = i * (candleWidth + candleGap) + candleWidth / 2;
      const y = priceToY(data[i].close);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }
}
