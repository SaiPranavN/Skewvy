import type { Metadata } from 'next';
import Link from 'next/link';
import { ReceiveLinkPanel } from '@/components/moodstamps/receive/ReceiveLinkPanel';
import { requireMoodStampsUser } from '@/lib/moodstamps/auth';
import { ensureInboxLink } from '@/lib/services/moodstamp-inbox';

export const metadata: Metadata = { title: 'Your MoodStamp link', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Receiving MoodStamps: the person's own link, ready to share the moment
 * they arrive here — made on the first visit, the same one after that.
 */
export default async function ReceiveMoodStampsRoute() {
  const user = await requireMoodStampsUser('/moodstamps/receive');
  const link = await ensureInboxLink(user.id);

  return (
    <div className="rail page-enter pb-[clamp(56px,7vw,110px)] pt-[clamp(24px,3vw,44px)]">
      <Link
        href="/moodstamps"
        className="inline-flex min-h-11 items-center gap-2 text-[13px] font-bold text-secondary transition-colors duration-150 hover:text-primary"
      >
        <span aria-hidden="true">←</span> Your MoodStamps
      </Link>

      <header className="mt-6 max-w-[720px]">
        <p className="eyebrow text-[color:var(--color-violet)]">Receive MoodStamps</p>
        <h1 className="display mt-3 text-[clamp(32px,4vw,54px)]">Let people tell you how you made them feel.</h1>
        <p className="mt-3 max-w-[56ch] text-[clamp(15px,1.15vw,17px)] leading-[1.5] text-secondary">
          This is your MoodStamp link. Put it in your bio, a group chat, a team channel — anywhere. Whoever opens it can
          send you a MoodStamp, with a Skewvy account or without one, and every one lands on your Received board.
        </p>
      </header>

      <div className="mt-[clamp(24px,3vw,40px)]">
        <ReceiveLinkPanel initial={link} emailVerified={Boolean(user.emailVerifiedAt)} />
      </div>
    </div>
  );
}
