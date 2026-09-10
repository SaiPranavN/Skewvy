'use client';

import { useEffect, useState } from 'react';
import { formatRelativeTime, formatDateTime } from '@/lib/domain/format';

/**
 * Time rendered relative to now.
 *
 * The server and the client evaluate "now" a moment apart, which is enough to
 * make "56m ago" and "57m ago" disagree and fail hydration — so the first paint
 * is allowed to differ, and the label then refreshes itself on a timer.
 */
export function RelativeTime({ iso, className }: { iso: string | null; className?: string }) {
  const [label, setLabel] = useState(() => formatRelativeTime(iso));

  useEffect(() => {
    setLabel(formatRelativeTime(iso));
    const timer = setInterval(() => setLabel(formatRelativeTime(iso)), 60_000);
    return () => clearInterval(timer);
  }, [iso]);

  if (!iso) return <span className={className}>{label}</span>;

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {label}
    </time>
  );
}

/** Absolute timestamp in the viewer's own locale and timezone. */
export function LocalDateTime({ iso, className }: { iso: string | null; className?: string }) {
  const [label, setLabel] = useState(() => formatDateTime(iso));

  useEffect(() => setLabel(formatDateTime(iso)), [iso]);

  if (!iso) return <span className={className}>{label}</span>;

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {label}
    </time>
  );
}
