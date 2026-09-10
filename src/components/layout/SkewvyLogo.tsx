export function SkewvyLogo({ className = '', showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden="true"
        className="relative grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-brand-bright to-egg-deep text-base font-black text-white shadow-[0_6px_18px_-6px_var(--color-brand)]"
      >
        <span className="-translate-y-px skew-x-[-10deg]">S</span>
      </span>
      {showWordmark && (
        <span className="text-[1.0625rem] font-bold tracking-[-0.02em] text-chalk">
          Skewvy
        </span>
      )}
    </span>
  );
}
