/**
 * The Skewvy wordmark: the full domain, set in the interface typeface, in
 * white. No icon, no monogram, no coloured letterform, and never inside a
 * badge or container — it behaves like a masthead.
 */
export function Wordmark({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const scale = { sm: '1rem', md: '1.1875rem', lg: '1.75rem' }[size];

  return (
    <span
      className={`inline-block select-none whitespace-nowrap font-normal tracking-[-0.005em] text-primary ${className}`}
      style={{ fontSize: scale, lineHeight: 1.1 }}
    >
      skewvy.com
    </span>
  );
}
