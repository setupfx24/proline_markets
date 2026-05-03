import { ChartTheme, Viewport } from '../core/types';

export class PriceScaleRenderer {
  constructor(private ctx: CanvasRenderingContext2D, private theme: ChartTheme) {}

  render(chartWidth: number, chartHeight: number, viewport: Viewport, digits: number) {
    const ctx = this.ctx;
    const priceRange = viewport.priceMax - viewport.priceMin;
    if (priceRange <= 0) return;

    const gridLines = 8;
    const priceStep = priceRange / gridLines;

    ctx.fillStyle = this.theme.background;
    ctx.fillRect(chartWidth, 0, 80, chartHeight);

    ctx.strokeStyle = this.theme.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartWidth, 0);
    ctx.lineTo(chartWidth, chartHeight);
    ctx.stroke();

    ctx.font = '10px JetBrains Mono';
    ctx.fillStyle = this.theme.text;
    ctx.textAlign = 'center';

    for (let i = 0; i <= gridLines; i++) {
      const price = viewport.priceMin + priceStep * i;
      const y = chartHeight - (i / gridLines) * chartHeight;
      ctx.fillText(price.toFixed(digits), chartWidth + 40, y + 3);
    }
  }
}
