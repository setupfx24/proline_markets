import { ChartTheme } from '../core/types';

export class CrosshairRenderer {
  constructor(private ctx: CanvasRenderingContext2D, private theme: ChartTheme) {}

  render(
    mouseX: number,
    mouseY: number,
    chartWidth: number,
    chartHeight: number,
    price: number,
    digits: number,
    priceScaleWidth: number
  ) {
    const ctx = this.ctx;

    ctx.strokeStyle = this.theme.crosshair;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 0.5;

    // Horizontal
    ctx.beginPath();
    ctx.moveTo(0, mouseY);
    ctx.lineTo(chartWidth, mouseY);
    ctx.stroke();

    // Vertical
    ctx.beginPath();
    ctx.moveTo(mouseX, 0);
    ctx.lineTo(mouseX, chartHeight);
    ctx.stroke();

    ctx.setLineDash([]);

    // Price label on right
    if (mouseY < chartHeight) {
      ctx.fillStyle = '#3a3d4e';
      ctx.fillRect(chartWidth, mouseY - 10, priceScaleWidth, 20);
      ctx.fillStyle = this.theme.text;
      ctx.font = '11px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText(price.toFixed(digits), chartWidth + priceScaleWidth / 2, mouseY + 4);
    }
  }
}
