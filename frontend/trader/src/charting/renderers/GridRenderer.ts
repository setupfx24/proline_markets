import { ChartTheme, Viewport } from '../core/types';

export class GridRenderer {
  constructor(private ctx: CanvasRenderingContext2D, private theme: ChartTheme) {}

  render(chartWidth: number, chartHeight: number, viewport: Viewport, digits: number) {
    const ctx = this.ctx;
    const priceRange = viewport.priceMax - viewport.priceMin;
    if (priceRange <= 0) return;

    const gridLines = 8;
    const priceStep = priceRange / gridLines;

    ctx.strokeStyle = this.theme.gridLine;
    ctx.lineWidth = 1;
    ctx.font = '10px JetBrains Mono';
    ctx.fillStyle = this.theme.textMuted;

    for (let i = 0; i <= gridLines; i++) {
      const price = viewport.priceMin + priceStep * i;
      const y = chartHeight - (i / gridLines) * chartHeight;

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();
    }

    const timeLines = 6;
    for (let i = 0; i <= timeLines; i++) {
      const x = (i / timeLines) * chartWidth;

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, chartHeight);
      ctx.stroke();
    }
  }
}
