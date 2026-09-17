/**
 * The Skewvy wordmark: the full domain set in Archivo Black, tightly tracked,
 * with the TLD carrying the orange. No icon, no monogram, never inside a badge
 * or container — it behaves like a masthead.
 */
export function Wordmark({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const scale = { sm: '20px', md: '26px', lg: '40px' }[size];

  return (
    <span
      className={`display inline-block select-none whitespace-nowrap text-primary ${className}`}
      style={{ fontSize: scale, lineHeight: 1, letterSpacing: '-0.03em' }}
    >
      skewvy<span className="text-brand">.com</span>
    </span>
  );
}
