/**
 * The windows the trend charts can be read over, and how each is bucketed.
 *
 * Lives outside the timeline service so the range picker in the browser can
 * import it without pulling in the database layer.
 *
 * Each range pairs a span with a bucket size chosen to keep the chart between
 * roughly seven and sixty points: an hour is the right grain for a day, and
 * absurd for five years.
 */

export const TREND_RANGES = ['24h', '1w', '1m', '3m', '6m', '1y', '5y'] as const;
export type TrendRange = (typeof TREND_RANGES)[number];

export type TrendStep = 'hour' | 'day' | 'week' | 'month';

export const RANGE_SPEC: Record<TrendRange, { label: string; long: string; days: number; step: TrendStep }> = {
  '24h': { label: '24H', long: 'Last 24 hours', days: 1, step: 'hour' },
  '1w': { label: '1W', long: 'Last week', days: 7, step: 'day' },
  '1m': { label: '1M', long: 'Last month', days: 30, step: 'day' },
  '3m': { label: '3M', long: 'Last 3 months', days: 91, step: 'week' },
  '6m': { label: '6M', long: 'Last 6 months', days: 182, step: 'week' },
  '1y': { label: '1Y', long: 'Last year', days: 365, step: 'week' },
  '5y': { label: '5Y', long: 'Last 5 years', days: 1826, step: 'month' },
};

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export function isTrendRange(value: unknown): value is TrendRange {
  return typeof value === 'string' && (TREND_RANGES as readonly string[]).includes(value);
}

/** The start of the bucket containing `ms`, in UTC. Weeks start on Monday. */
export function bucketStart(ms: number, step: TrendStep): number {
  if (step === 'hour') return Math.floor(ms / HOUR_MS) * HOUR_MS;
  const day = Math.floor(ms / DAY_MS) * DAY_MS;
  if (step === 'day') return day;
  if (step === 'week') {
    const weekday = (new Date(day).getUTCDay() + 6) % 7;
    return day - weekday * DAY_MS;
  }
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

/** The start of the next bucket. Months are calendar months, not thirty days. */
export function nextBucket(start: number, step: TrendStep): number {
  if (step === 'hour') return start + HOUR_MS;
  if (step === 'day') return start + DAY_MS;
  if (step === 'week') return start + 7 * DAY_MS;
  const date = new Date(start);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

export function previousBucket(start: number, step: TrendStep): number {
  if (step === 'month') {
    const date = new Date(start);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1);
  }
  return bucketStart(start - 1, step);
}

/**
 * The smallest range that shows the whole of an artifact's history.
 *
 * Opening a nine-hour-old story on "5Y" would draw one point, and opening a
 * three-year-old entity on "24H" would hide everything that made its record —
 * so the chart starts on the window that fits, and the picker is there to
 * zoom in or out from it.
 */
export function defaultRange(firstActivityMs: number | null, now = Date.now()): TrendRange {
  if (firstActivityMs === null) return '1m';
  const age = now - firstActivityMs;
  return TREND_RANGES.find((range) => RANGE_SPEC[range].days * DAY_MS >= age) ?? '5y';
}
