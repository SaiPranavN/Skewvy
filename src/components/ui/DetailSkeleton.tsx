/**
 * The shape of a Profile or Story page while it loads.
 *
 * Shown the instant a card is clicked — Next prefetches this shell with the
 * link — so the click answers immediately and the real page replaces it in
 * place, without the layout jumping.
 */
export function DetailSkeleton({ kind }: { kind: 'profile' | 'story' }) {
  return (
    <div className="rail pt-[clamp(24px,3.2vw,52px)]" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-3 w-40" />

      <div className="mt-[clamp(16px,2vw,24px)] flex flex-wrap items-start gap-x-[clamp(22px,3vw,52px)] gap-y-6">
        <div className="min-w-[min(100%,300px)] flex-[1_1_440px]">
          <div className="flex items-start gap-[clamp(16px,2vw,26px)]">
            {kind === 'profile' && <div className="skeleton h-[clamp(84px,9vw,120px)] w-[clamp(84px,9vw,120px)] flex-none" />}
            <div className="min-w-0 flex-1">
              <div className="skeleton h-6 w-44" />
              <div className="skeleton mt-4 h-[clamp(36px,5vw,72px)] w-4/5" />
              {kind === 'story' && <div className="skeleton mt-3 h-[clamp(36px,5vw,72px)] w-3/5" />}
            </div>
          </div>
          <div className="skeleton mt-6 h-4 w-full max-w-[48ch]" />
          <div className="skeleton mt-2.5 h-4 w-3/4 max-w-[40ch]" />
        </div>

        <div className="skeleton h-[180px] min-w-[min(100%,280px)] max-w-[520px] flex-[1_1_320px]" />
      </div>

      <div className="skeleton mt-[clamp(24px,3vw,44px)] h-[clamp(380px,34vw,460px)] w-full" />
    </div>
  );
}
