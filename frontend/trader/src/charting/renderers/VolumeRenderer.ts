import { OHLCV, ChartTheme, Viewport } from '../core/types';

export class VolumeRenderer {
  constructor(private ctx: CanvasRenderingContext2D, private theme: ChartTheme) {}

  render(
    data: OHLCV[],
    viewport: Viewport,
    candleWidth: number,
    candleGap: number,
    chartWidth: number,
    chartHeight: number,
    volumeHeight: number
  ) {
    const ctx = this.ctx;
    if (data.length === 0) return;

    let maxVolume = 0;
    for (const bar of data) {
      maxVolume = Math.max(maxVolume, bar.volume);
    }
    if (maxVolume === 0) return;

    const volumeTop = chartHeight;

    for (let i = 0; i < data.length; i++) {
      const bar = data[i];
      const x = i * (candleWidth + candleGap);
      const barH = (bar.volume / maxVolume) * volumeHeight;
      const y = volumeTop + volumeHeight - barH;

      const isBull = bar.close >= bar.open;
      ctx.fillStyle = isBull ? this.theme.volumeUp : this.theme.volumeDown;
      ctx.fillRect(x, y, candleWidth, barH);
    }
  }
}
