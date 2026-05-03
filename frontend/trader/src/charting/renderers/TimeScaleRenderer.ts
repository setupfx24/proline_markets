import { OHLCV, ChartTheme, Viewport } from '../core/types';

export class TimeScaleRenderer {
  constructor(private ctx: CanvasRenderingContext2D, private theme: ChartTheme) {}

  render(
    data: OHLCV[],
    viewport: Viewport,
    candleWidth: number,
    candleGap: number,
    chartWidth: number,
    yOffset: number,
    height: number
  ) {
    const ctx = this.ctx;
    if (data.length === 0) return;

    ctx.fillStyle = this.theme.background;
    ctx.fillRect(0, yOffset, chartWidth + 80, height);

    ctx.strokeStyle = this.theme.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, yOffset);
    ctx.lineTo(chartWidth, yOffset);
    ctx.stroke();

    ctx.font = '10px JetBrains Mono';
    ctx.fillStyle = this.theme.textMuted;
    ctx.textAlign = 'center';

    const labelInterval = Math.max(1, Math.floor(data.length / 8));

    for (let i = 0; i < data.length; i += labelInterval) {
      const bar = data[i];
      const x = i * (candleWidth + candleGap) + candleWidth / 2;

      const date = new Date(bar.time * 1000);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');

      let label: string;
      if (hours === '00' && minutes === '00') {
        label = `${month}/${day}`;
      } else {
        label = `${hours}:${minutes}`;
      }

      ctx.fillText(label, x, yOffset + 18);
    }
  }
}
