import { OHLCV, Viewport, ChartTheme, DARK_THEME, ChartType } from './types';
import { CandlestickRenderer } from '../renderers/CandlestickRenderer';
import { LineRenderer } from '../renderers/LineRenderer';
import { AreaRenderer } from '../renderers/AreaRenderer';
import { GridRenderer } from '../renderers/GridRenderer';
import { CrosshairRenderer } from '../renderers/CrosshairRenderer';
import { VolumeRenderer } from '../renderers/VolumeRenderer';
import { PriceScaleRenderer } from '../renderers/PriceScaleRenderer';
import { TimeScaleRenderer } from '../renderers/TimeScaleRenderer';

export class ChartEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: OHLCV[] = [];
  private viewport: Viewport = { startIndex: 0, endIndex: 100, priceMin: 0, priceMax: 0 };
  private theme: ChartTheme = DARK_THEME;
  private chartType: ChartType = 'candlestick';
  private candleWidth = 8;
  private candleGap = 2;
  private priceScaleWidth = 80;
  private timeScaleHeight = 30;
  private volumeHeight = 60;
  private mouseX = -1;
  private mouseY = -1;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartIndex = 0;
  private currentPrice: number | null = null;
  private digits = 5;
  private animationFrame: number | null = null;

  private gridRenderer: GridRenderer;
  private candleRenderer: CandlestickRenderer;
  private lineRenderer: LineRenderer;
  private areaRenderer: AreaRenderer;
  private crosshairRenderer: CrosshairRenderer;
  private volumeRenderer: VolumeRenderer;
  private priceScaleRenderer: PriceScaleRenderer;
  private timeScaleRenderer: TimeScaleRenderer;

  private indicators: { name: string; data: number[]; color: string }[] = [];
  private slPrice: number | null = null;
  private tpPrice: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    this.gridRenderer = new GridRenderer(this.ctx, this.theme);
    this.candleRenderer = new CandlestickRenderer(this.ctx, this.theme);
    this.lineRenderer = new LineRenderer(this.ctx);
    this.areaRenderer = new AreaRenderer(this.ctx);
    this.crosshairRenderer = new CrosshairRenderer(this.ctx, this.theme);
    this.volumeRenderer = new VolumeRenderer(this.ctx, this.theme);
    this.priceScaleRenderer = new PriceScaleRenderer(this.ctx, this.theme);
    this.timeScaleRenderer = new TimeScaleRenderer(this.ctx, this.theme);

    this.setupEventListeners();
    this.resize();
  }

  private setupEventListeners() {
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('mouseleave', this.onMouseLeave);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('resize', this.onResize);
  }

  destroy() {
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('mouseleave', this.onMouseLeave);
    this.canvas.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('resize', this.onResize);
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
  }

  resize() {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.scale(dpr, dpr);

    this.render();
  }

  setData(data: OHLCV[]) {
    this.data = data;
    if (data.length > 0) {
      const visibleBars = this.getVisibleBars();
      this.viewport.startIndex = Math.max(0, data.length - visibleBars);
      this.viewport.endIndex = data.length;
      this.autoScale();
    }
    this.render();
  }

  appendCandle(candle: OHLCV) {
    if (this.data.length > 0) {
      const last = this.data[this.data.length - 1];
      if (last.time === candle.time) {
        this.data[this.data.length - 1] = candle;
      } else {
        this.data.push(candle);
        if (this.viewport.endIndex === this.data.length - 1) {
          this.viewport.startIndex++;
          this.viewport.endIndex++;
        }
      }
    } else {
      this.data.push(candle);
    }
    this.autoScale();
    this.render();
  }

  setChartType(type: ChartType) {
    this.chartType = type;
    this.render();
  }

  setCurrentPrice(price: number) {
    this.currentPrice = price;
    this.render();
  }

  setDigits(digits: number) {
    this.digits = digits;
  }

  setSLTP(sl: number | null, tp: number | null) {
    this.slPrice = sl;
    this.tpPrice = tp;
    this.render();
  }

  setIndicatorData(name: string, data: number[], color: string) {
    const existing = this.indicators.findIndex((i) => i.name === name);
    if (existing >= 0) {
      this.indicators[existing] = { name, data, color };
    } else {
      this.indicators.push({ name, data, color });
    }
    this.render();
  }

  removeIndicator(name: string) {
    this.indicators = this.indicators.filter((i) => i.name !== name);
    this.render();
  }

  private getVisibleBars(): number {
    const chartWidth = this.getChartWidth();
    return Math.floor(chartWidth / (this.candleWidth + this.candleGap));
  }

  private getChartWidth(): number {
    return (this.canvas.width / (window.devicePixelRatio || 1)) - this.priceScaleWidth;
  }

  private getChartHeight(): number {
    return (this.canvas.height / (window.devicePixelRatio || 1)) - this.timeScaleHeight - this.volumeHeight;
  }

  private autoScale() {
    const visible = this.getVisibleData();
    if (visible.length === 0) return;

    let min = Infinity;
    let max = -Infinity;
    for (const bar of visible) {
      min = Math.min(min, bar.low);
      max = Math.max(max, bar.high);
    }

    const padding = (max - min) * 0.1;
    this.viewport.priceMin = min - padding;
    this.viewport.priceMax = max + padding;
  }

  private getVisibleData(): OHLCV[] {
    return this.data.slice(this.viewport.startIndex, this.viewport.endIndex);
  }

  private priceToY(price: number): number {
    const chartHeight = this.getChartHeight();
    const range = this.viewport.priceMax - this.viewport.priceMin;
    if (range === 0) return chartHeight / 2;
    return chartHeight - ((price - this.viewport.priceMin) / range) * chartHeight;
  }

  private yToPrice(y: number): number {
    const chartHeight = this.getChartHeight();
    const range = this.viewport.priceMax - this.viewport.priceMin;
    return this.viewport.priceMax - (y / chartHeight) * range;
  }

  private indexToX(index: number): number {
    const relativeIndex = index - this.viewport.startIndex;
    return relativeIndex * (this.candleWidth + this.candleGap) + this.candleWidth / 2;
  }

  render() {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = requestAnimationFrame(() => this._render());
  }

  private _render() {
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);

    this.ctx.clearRect(0, 0, w, h);
    this.ctx.fillStyle = this.theme.background;
    this.ctx.fillRect(0, 0, w, h);

    if (this.data.length === 0) {
      this.ctx.fillStyle = this.theme.text;
      this.ctx.font = '14px Inter';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('No data', w / 2, h / 2);
      return;
    }

    const chartWidth = this.getChartWidth();
    const chartHeight = this.getChartHeight();
    const visible = this.getVisibleData();

    this.ctx.save();

    this.gridRenderer.render(chartWidth, chartHeight, this.viewport, this.digits);

    this.ctx.beginPath();
    this.ctx.rect(0, 0, chartWidth, chartHeight);
    this.ctx.clip();

    if (this.chartType === 'candlestick' || this.chartType === 'heikin_ashi') {
      const renderData = this.chartType === 'heikin_ashi' ? this.toHeikinAshi(visible) : visible;
      this.candleRenderer.render(
        renderData, this.viewport, this.candleWidth, this.candleGap, chartHeight
      );
    } else if (this.chartType === 'line') {
      this.lineRenderer.render(
        visible, this.viewport, this.candleWidth, this.candleGap, chartHeight, '#3B82F6'
      );
    } else if (this.chartType === 'area') {
      this.areaRenderer.render(
        visible, this.viewport, this.candleWidth, this.candleGap, chartHeight, '#3B82F6'
      );
    }

    for (const indicator of this.indicators) {
      const startI = this.viewport.startIndex;
      const endI = this.viewport.endIndex;
      const indicatorSlice = indicator.data.slice(startI, endI);

      this.ctx.strokeStyle = indicator.color;
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();

      let started = false;
      for (let i = 0; i < indicatorSlice.length; i++) {
        const val = indicatorSlice[i];
        if (val === null || val === undefined || isNaN(val)) continue;

        const x = i * (this.candleWidth + this.candleGap) + this.candleWidth / 2;
        const y = this.priceToY(val);

        if (!started) {
          this.ctx.moveTo(x, y);
          started = true;
        } else {
          this.ctx.lineTo(x, y);
        }
      }
      this.ctx.stroke();
    }

    if (this.currentPrice !== null) {
      const y = this.priceToY(this.currentPrice);
      this.ctx.strokeStyle = this.theme.currentPriceLine;
      this.ctx.setLineDash([4, 4]);
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(chartWidth, y);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      this.ctx.fillStyle = this.theme.currentPriceLine;
      this.ctx.fillRect(chartWidth, y - 10, this.priceScaleWidth, 20);
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '11px JetBrains Mono';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(this.currentPrice.toFixed(this.digits), chartWidth + this.priceScaleWidth / 2, y + 4);
    }

    if (this.slPrice !== null) {
      const y = this.priceToY(this.slPrice);
      this.ctx.strokeStyle = this.theme.slLine;
      this.ctx.setLineDash([3, 3]);
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(chartWidth, y);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      this.ctx.fillStyle = this.theme.slLine;
      this.ctx.font = '10px Inter';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(`SL ${this.slPrice.toFixed(this.digits)}`, 5, y - 5);
    }

    if (this.tpPrice !== null) {
      const y = this.priceToY(this.tpPrice);
      this.ctx.strokeStyle = this.theme.tpLine;
      this.ctx.setLineDash([3, 3]);
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(chartWidth, y);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      this.ctx.fillStyle = this.theme.tpLine;
      this.ctx.font = '10px Inter';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(`TP ${this.tpPrice.toFixed(this.digits)}`, 5, y - 5);
    }

    this.ctx.restore();

    this.volumeRenderer.render(
      visible, this.viewport, this.candleWidth, this.candleGap,
      chartWidth, chartHeight, this.volumeHeight
    );

    this.priceScaleRenderer.render(
      chartWidth, chartHeight, this.viewport, this.digits
    );

    this.timeScaleRenderer.render(
      visible, this.viewport, this.candleWidth, this.candleGap,
      chartWidth, chartHeight + this.volumeHeight, this.timeScaleHeight
    );

    if (this.mouseX >= 0 && this.mouseX < chartWidth && this.mouseY >= 0) {
      this.crosshairRenderer.render(
        this.mouseX, this.mouseY, chartWidth, chartHeight,
        this.yToPrice(this.mouseY), this.digits,
        this.priceScaleWidth
      );
    }
  }

  private toHeikinAshi(data: OHLCV[]): OHLCV[] {
    const ha: OHLCV[] = [];
    for (let i = 0; i < data.length; i++) {
      const prev = i > 0 ? ha[i - 1] : data[i];
      const close = (data[i].open + data[i].high + data[i].low + data[i].close) / 4;
      const open = (prev.open + prev.close) / 2;
      ha.push({
        time: data[i].time,
        open,
        high: Math.max(data[i].high, open, close),
        low: Math.min(data[i].low, open, close),
        close,
        volume: data[i].volume,
      });
    }
    return ha;
  }

  private onMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;

    if (this.isDragging) {
      const dx = e.clientX - this.dragStartX;
      const barsShift = Math.round(dx / (this.candleWidth + this.candleGap));
      const newStart = this.dragStartIndex - barsShift;
      const visibleBars = this.viewport.endIndex - this.viewport.startIndex;

      this.viewport.startIndex = Math.max(0, Math.min(newStart, this.data.length - visibleBars));
      this.viewport.endIndex = this.viewport.startIndex + visibleBars;
      this.autoScale();
    }

    this.render();
  };

  private onMouseDown = (e: MouseEvent) => {
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartIndex = this.viewport.startIndex;
    this.canvas.style.cursor = 'grabbing';
  };

  private onMouseUp = () => {
    this.isDragging = false;
    this.canvas.style.cursor = 'crosshair';
  };

  private onMouseLeave = () => {
    this.mouseX = -1;
    this.mouseY = -1;
    this.isDragging = false;
    this.canvas.style.cursor = 'crosshair';
    this.render();
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;

    const newCandleWidth = Math.max(2, Math.min(30, this.candleWidth * (1 / zoomFactor)));
    this.candleWidth = newCandleWidth;

    const visibleBars = this.getVisibleBars();
    const center = Math.floor((this.viewport.startIndex + this.viewport.endIndex) / 2);

    this.viewport.startIndex = Math.max(0, center - Math.floor(visibleBars / 2));
    this.viewport.endIndex = Math.min(this.data.length, this.viewport.startIndex + visibleBars);

    this.autoScale();
    this.render();
  };

  private onResize = () => {
    this.resize();
  };
}
