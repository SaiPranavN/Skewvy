/**
 * A count as people read one: exact below a thousand, then 1k, 1.2k, 45.6k,
 * 1M, 2.3B. Rounded down, never up, so a figure is never shown as more than
 * it is — 1,999 reads 1.9k, not 2k. Used for every public total: opinions,
 * Medals, Rotten Eggs, taps, people.
 */
export function formatCount(value: number): string {
  const count = Math.max(0, Math.round(value));
  if (count < 1_000) return String(count);
  for (const [size, suffix] of COMPACT_UNITS) {
    if (count >= size) {
      const tenths = Math.floor((count * 10) / size);
      return `${tenths % 10 === 0 ? tenths / 10 : (tenths / 10).toFixed(1)}${suffix}`;
    }
  }
  return String(count);
}

const COMPACT_UNITS: Array<[number, string]> = [
  [1_000_000_000, 'B'],
  [1_000_000, 'M'],
  [1_000, 'k'],
];

/** The same as `formatCount`; kept for the dense spots that asked for it by name. */
export const formatCompact = formatCount;

/** Every digit, grouped: for admin screens and anything that must be exact. */
export function formatExact(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(value)));
}

/**
 * Whole-number share of one side. Deliberately integer-only: the brief forbids
 * fake precision such as decimals that twitch on every tap.
 */
export function sharePercent(part: number, whole: number): number {
  if (whole <= 0) return 50;
  return Math.round((part / whole) * 100);
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Unpublished';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
