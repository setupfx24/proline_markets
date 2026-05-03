/**
 * Economic calendar — API-oriented types and mock data.
 * Replace `getEconomicCalendarEvents` in `app/api/economic-calendar/route.ts`
 * with a proxy to your provider when ready; keep the same JSON shape.
 */

export type EconomicImpactLevel = 'high' | 'medium' | 'low';

/** One row as returned by GET /api/economic-calendar */
export interface EconomicCalendarEventDTO {
  id: string;
  /** ISO 8601 instant (UTC or with offset) */
  datetime: string;
  region?: string;
  currency: string;
  /** Optional emoji or URL from API */
  flag?: string;
  impact: EconomicImpactLevel;
  title: string;
  actual?: string | null;
  previous?: string | null;
  consensus?: string | null;
}

export interface EconomicCalendarApiResponse {
  events: EconomicCalendarEventDTO[];
}

// ——— Mock generator (same data as before; used by API route until you wire a real source) ———

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function atTime(day: Date, hour: number, minute: number): Date {
  const x = new Date(day.getTime());
  x.setHours(hour, minute, 0, 0);
  return x;
}

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildAllMockEvents(todayStart: Date): EconomicCalendarEventDTO[] {
  const y = addDays(todayStart, -1);
  const t = todayStart;
  const tm = addDays(todayStart, 1);

  const row = (
    day: Date,
    hour: number,
    minute: number,
    currency: string,
    flag: string,
    impact: EconomicImpactLevel,
    title: string,
    region: string | undefined,
    actual?: string,
    previous?: string,
    consensus?: string,
  ): EconomicCalendarEventDTO => {
    const when = atTime(day, hour, minute);
    return {
      id: `${title}-${when.getTime()}`,
      datetime: when.toISOString(),
      region,
      currency,
      flag,
      impact,
      title,
      actual: actual ?? null,
      previous: previous ?? null,
      consensus: consensus ?? null,
    };
  };

  return [
    row(y, 22, 30, 'EUR', '🇪🇺', 'low', 'Consumer Confidence', 'EU', '−12', '−14', '−13'),
    row(y, 23, 15, 'USD', '🇺🇸', 'medium', 'Fed Speaker', 'US', undefined, undefined, undefined),
    row(t, 5, 31, 'EUR', '🇪🇺', 'low', 'AIB Services PMI', 'EU', '54.2', '53.8', '54.0'),
    row(t, 6, 30, 'AUD', '🇦🇺', 'high', 'Inflation Rate YoY', 'AU', '3.2%', '3.4%', '3.1%'),
    row(t, 7, 0, 'BDT', '🇧🇩', 'low', 'FX Reserves', 'BD', '$48.2B', '$47.9B', '—'),
    row(t, 8, 30, 'GBP', '🇬🇧', 'medium', 'GDP Estimate', 'GB', '0.3%', '0.2%', '0.25%'),
    row(t, 10, 0, 'USD', '🇺🇸', 'high', 'Non-Farm Payrolls', 'US', '185K', '175K', '180K'),
    row(t, 12, 30, 'CAD', '🇨🇦', 'medium', 'Employment Change', 'CA', '24.5K', '18.2K', '20.0K'),
    row(t, 14, 0, 'JPY', '🇯🇵', 'low', 'BoJ Summary of Opinions', 'JP', '—', '—', '—'),
    row(t, 15, 45, 'EUR', '🇪🇺', 'high', 'ECB Rate Decision', 'EU', '4.50%', '4.50%', '4.50%'),
    row(t, 18, 0, 'NZD', '🇳🇿', 'medium', 'Trade Balance', 'NZ', '−0.42B', '−0.51B', '−0.38B'),
    row(tm, 1, 0, 'CHF', '🇨🇭', 'low', 'SECO Consumer Climate', 'CH', '−36', '−38', '−37'),
    row(tm, 4, 30, 'CNY', '🇨🇳', 'high', 'Manufacturing PMI', 'CN', '50.1', '49.8', '50.0'),
    row(tm, 9, 0, 'GBP', '🇬🇧', 'medium', 'Retail Sales MoM', 'GB', '0.4%', '−0.2%', '0.2%'),
    row(tm, 13, 30, 'USD', '🇺🇸', 'high', 'CPI YoY', 'US', '3.1%', '3.2%', '3.0%'),
    row(addDays(todayStart, 2), 10, 0, 'EUR', '🇪🇺', 'medium', 'ZEW Economic Sentiment', 'EU', '12.4', '9.8', '11.0'),
    row(addDays(todayStart, 3), 14, 0, 'AUD', '🇦🇺', 'low', 'RBA Meeting Minutes', 'AU', '—', '—', '—'),
    row(addDays(todayStart, 5), 8, 0, 'JPY', '🇯🇵', 'medium', 'Tankan Large Manufacturers', 'JP', '12', '10', '11'),
  ];
}

/** Filter mock events whose local calendar day falls in [fromYmd, toYmd] inclusive. */
export function getMockCalendarEventsForRange(fromYmd: string, toYmd: string): EconomicCalendarEventDTO[] {
  const now = new Date();
  const todayStart = startOfDay(now);
  const all = buildAllMockEvents(todayStart);
  return all.filter((e) => {
    const ymd = toLocalYmd(new Date(e.datetime));
    return ymd >= fromYmd && ymd <= toYmd;
  });
}

export type CalendarDayTab = 'yesterday' | 'today' | 'tomorrow' | 'week';

/** Local calendar bounds for the selected tab (client sends these to the API). */
export function getCalendarQueryRange(dayTab: CalendarDayTab, now = new Date()): { from: string; to: string } {
  const todayStart = startOfDay(now);
  if (dayTab === 'yesterday') {
    const d = addDays(todayStart, -1);
    return { from: toLocalYmd(d), to: toLocalYmd(d) };
  }
  if (dayTab === 'today') {
    return { from: toLocalYmd(todayStart), to: toLocalYmd(todayStart) };
  }
  if (dayTab === 'tomorrow') {
    const d = addDays(todayStart, 1);
    return { from: toLocalYmd(d), to: toLocalYmd(d) };
  }
  const end = addDays(todayStart, 6);
  return { from: toLocalYmd(todayStart), to: toLocalYmd(end) };
}
