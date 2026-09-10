/** Full-precision grouped number — the reaction totals must never be abbreviated away. */
export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(value)));
}

/** Compact form for dense secondary spots only (leaderboard deltas, chips). */
export function formatCompact(value: number): string {
  const rounded = Math.max(0, Math.round(value));
  if (rounded < 10_000) return formatCount(rounded);
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(rounded);
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
