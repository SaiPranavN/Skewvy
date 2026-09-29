import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OptOutConfirm } from '@/components/moodstamps/recipient/OptOutConfirm';
import { recipientLinkExists } from '@/lib/services/moodstamp-delivery';

export const metadata: Metadata = {
  title: 'Stop MoodStamps',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};
export const dynamic = 'force-dynamic';

/** Where the "stop" link in a MoodStamp email leads. No account needed. */
export default async function MoodStampOptOutRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await recipientLinkExists(token))) notFound();

  return (
    <div className="rail page-enter pb-[clamp(56px,7vw,110px)] pt-[clamp(32px,4vw,64px)]">
      <div className="max-w-[620px]">
        <p className="eyebrow text-[color:var(--color-violet)]">MoodStamps</p>
        <h1 className="display mt-3 text-[clamp(32px,4vw,54px)]">Stop MoodStamps to your email?</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-secondary">
          Nobody will be able to email you a MoodStamp through Skewvy again, from anyone. The ones you already have are
          not affected. People who try will be told this address does not accept them.
        </p>
        <OptOutConfirm token={token} />
      </div>
    </div>
  );
}
