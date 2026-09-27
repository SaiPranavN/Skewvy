import Link from 'next/link';
import { MOODSTAMP_TAGLINE } from '@/lib/moodstamps/types';
import { ArrowRightIcon } from './icons';

/**
 * A reserved MoodStamps route whose workflow has not been built yet.
 *
 * It says so plainly and sends the person back to their board. No form, no
 * pretend steps: a half-working version of sending something personal is
 * worse than an honest "not yet".
 */
export function MoodStampNextIteration({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rail page-enter pb-[clamp(56px,7vw,110px)] pt-[clamp(24px,3vw,44px)]">
      <Link
        href="/moodstamps"
        className="inline-flex min-h-11 items-center gap-2 text-[13px] font-bold text-secondary transition-colors duration-150 hover:text-primary"
      >
        <span aria-hidden="true">←</span> Your MoodStamps
      </Link>

      <div className="mt-6 max-w-[640px]">
        <p className="eyebrow text-[color:var(--color-violet)]">{eyebrow}</p>
        <h1 className="display mt-3 text-[clamp(36px,4.4vw,60px)]">{title}</h1>
        <p className="mt-4 max-w-[46ch] text-[clamp(15px,1.15vw,17px)] leading-[1.55] text-secondary">{description}</p>

        <div className="slab mt-10 p-[clamp(20px,2.6vw,32px)]" style={{ boxShadow: '10px 10px 0 var(--color-violet)' }}>
          <p className="flag bg-[var(--color-violet)]">Coming in the next iteration</p>
          <p className="mt-5 text-[17px] font-bold leading-snug">{MOODSTAMP_TAGLINE}</p>
          <p className="mt-2 text-[15px] leading-relaxed text-secondary">
            This part of MoodStamps is being built now. Your board is ready and waiting in the meantime.
          </p>
          <Link href="/moodstamps" className="btn btn-paper mt-6 min-h-12 border-2 border-[var(--color-ink)]">
            Back to your board
            <ArrowRightIcon />
          </Link>
        </div>
      </div>
    </div>
  );
}
