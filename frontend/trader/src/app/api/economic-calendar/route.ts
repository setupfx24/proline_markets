import { NextResponse } from 'next/server';
import {
  getMockCalendarEventsForRange,
  type EconomicCalendarApiResponse,
} from '@/lib/economic-calendar';

/**
 * GET /api/economic-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Today returns mock data filtered to the requested local date range.
 * Replace the body with your upstream API / DB when ready; keep the JSON shape
 * (`{ events: EconomicCalendarEventDTO[] }`) so the UI stays unchanged.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'Query params from and to (YYYY-MM-DD) are required.' }, { status: 400 });
  }

  if (from > to) {
    return NextResponse.json({ error: 'from must be <= to.' }, { status: 400 });
  }

  // TODO: proxy to TradingEconomics / internal service / DB using `from`, `to`, optional `tz`.
  const events = getMockCalendarEventsForRange(from, to);
  const body: EconomicCalendarApiResponse = { events };

  return NextResponse.json(body);
}
