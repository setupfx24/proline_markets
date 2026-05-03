import { OHLCV } from '../core/types';

export function sma(data: OHLCV[], period: number): number[] {
  const result: number[] = new Array(data.length).fill(NaN);
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j].close;
    result[i] = sum / period;
  }
  return result;
}

export function ema(data: OHLCV[], period: number): number[] {
  const result: number[] = new Array(data.length).fill(NaN);
  const k = 2 / (period + 1);
  result[period - 1] = data.slice(0, period).reduce((s, d) => s + d.close, 0) / period;
  for (let i = period; i < data.length; i++) {
    result[i] = data[i].close * k + result[i - 1] * (1 - k);
  }
  return result;
}

export function bollingerBands(data: OHLCV[], period = 20, stdDev = 2): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(data, period);
  const upper: number[] = new Array(data.length).fill(NaN);
  const lower: number[] = new Array(data.length).fill(NaN);

  for (let i = period - 1; i < data.length; i++) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSq += (data[j].close - middle[i]) ** 2;
    }
    const std = Math.sqrt(sumSq / period);
    upper[i] = middle[i] + stdDev * std;
    lower[i] = middle[i] - stdDev * std;
  }

  return { upper, middle, lower };
}

export function rsi(data: OHLCV[], period = 14): number[] {
  const result: number[] = new Array(data.length).fill(NaN);
  if (data.length < period + 1) return result;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  result[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    result[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  return result;
}

export function macd(data: OHLCV[], fast = 12, slow = 26, signal = 9): { macd: number[]; signal: number[]; histogram: number[] } {
  const fastEma = ema(data, fast);
  const slowEma = ema(data, slow);
  const macdLine: number[] = new Array(data.length).fill(NaN);

  for (let i = 0; i < data.length; i++) {
    if (!isNaN(fastEma[i]) && !isNaN(slowEma[i])) {
      macdLine[i] = fastEma[i] - slowEma[i];
    }
  }

  const signalLine: number[] = new Array(data.length).fill(NaN);
  const k = 2 / (signal + 1);
  let firstValid = -1;
  for (let i = 0; i < data.length; i++) {
    if (!isNaN(macdLine[i])) { firstValid = i; break; }
  }

  if (firstValid >= 0 && firstValid + signal - 1 < data.length) {
    let sum = 0;
    for (let i = firstValid; i < firstValid + signal; i++) sum += macdLine[i];
    signalLine[firstValid + signal - 1] = sum / signal;

    for (let i = firstValid + signal; i < data.length; i++) {
      if (!isNaN(macdLine[i])) {
        signalLine[i] = macdLine[i] * k + signalLine[i - 1] * (1 - k);
      }
    }
  }

  const histogram: number[] = new Array(data.length).fill(NaN);
  for (let i = 0; i < data.length; i++) {
    if (!isNaN(macdLine[i]) && !isNaN(signalLine[i])) {
      histogram[i] = macdLine[i] - signalLine[i];
    }
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

export function stochastic(data: OHLCV[], kPeriod = 14, dPeriod = 3): { k: number[]; d: number[] } {
  const kValues: number[] = new Array(data.length).fill(NaN);

  for (let i = kPeriod - 1; i < data.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      highest = Math.max(highest, data[j].high);
      lowest = Math.min(lowest, data[j].low);
    }
    const range = highest - lowest;
    kValues[i] = range === 0 ? 50 : ((data[i].close - lowest) / range) * 100;
  }

  const dValues: number[] = new Array(data.length).fill(NaN);
  for (let i = kPeriod - 1 + dPeriod - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - dPeriod + 1; j <= i; j++) sum += kValues[j];
    dValues[i] = sum / dPeriod;
  }

  return { k: kValues, d: dValues };
}

export function atr(data: OHLCV[], period = 14): number[] {
  const result: number[] = new Array(data.length).fill(NaN);
  const trValues: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      trValues.push(data[i].high - data[i].low);
    } else {
      const tr = Math.max(
        data[i].high - data[i].low,
        Math.abs(data[i].high - data[i - 1].close),
        Math.abs(data[i].low - data[i - 1].close)
      );
      trValues.push(tr);
    }
  }

  if (trValues.length >= period) {
    let sum = 0;
    for (let i = 0; i < period; i++) sum += trValues[i];
    result[period - 1] = sum / period;

    for (let i = period; i < data.length; i++) {
      result[i] = (result[i - 1] * (period - 1) + trValues[i]) / period;
    }
  }

  return result;
}

export function vwap(data: OHLCV[]): number[] {
  const result: number[] = new Array(data.length).fill(NaN);
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < data.length; i++) {
    const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
    cumulativeTPV += typicalPrice * (data[i].volume || 1);
    cumulativeVolume += data[i].volume || 1;
    result[i] = cumulativeTPV / cumulativeVolume;
  }

  return result;
}

export function ichimoku(data: OHLCV[], tenkan = 9, kijun = 26, senkou = 52): {
  tenkanSen: number[]; kijunSen: number[];
  senkouA: number[]; senkouB: number[];
  chikouSpan: number[];
} {
  const len = data.length;
  const tenkanSen: number[] = new Array(len).fill(NaN);
  const kijunSen: number[] = new Array(len).fill(NaN);
  const senkouA: number[] = new Array(len).fill(NaN);
  const senkouB: number[] = new Array(len).fill(NaN);
  const chikouSpan: number[] = new Array(len).fill(NaN);

  const midpoint = (arr: OHLCV[], start: number, period: number) => {
    let high = -Infinity, low = Infinity;
    for (let i = start; i < start + period && i < arr.length; i++) {
      high = Math.max(high, arr[i].high);
      low = Math.min(low, arr[i].low);
    }
    return (high + low) / 2;
  };

  for (let i = tenkan - 1; i < len; i++) {
    tenkanSen[i] = midpoint(data, i - tenkan + 1, tenkan);
  }

  for (let i = kijun - 1; i < len; i++) {
    kijunSen[i] = midpoint(data, i - kijun + 1, kijun);
  }

  for (let i = kijun - 1; i < len; i++) {
    if (!isNaN(tenkanSen[i]) && !isNaN(kijunSen[i])) {
      const idx = i + kijun;
      if (idx < len) senkouA[idx] = (tenkanSen[i] + kijunSen[i]) / 2;
    }
  }

  for (let i = senkou - 1; i < len; i++) {
    const idx = i + kijun;
    if (idx < len) senkouB[idx] = midpoint(data, i - senkou + 1, senkou);
  }

  for (let i = 0; i < len - kijun; i++) {
    chikouSpan[i] = data[i + kijun]?.close ?? NaN;
  }

  return { tenkanSen, kijunSen, senkouA, senkouB, chikouSpan };
}
