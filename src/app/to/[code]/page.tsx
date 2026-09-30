import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { LinkComposer } from '@/components/moodstamps/link/LinkComposer';
import { getCurrentUser } from '@/lib/auth/current-user';
import { resolveInboxLink } from '@/lib/services/moodstamp-inbox';
import { turnstileConfigured, turnstileDisabled, turnstileSiteKey } from '@/lib/services/turnstile';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ code: string }> };

/**
 * The page behind a MoodStamp link: skewvy.com/to/<code>.
 *
 * Public, and meant to be shared, but never indexed — it is one person's
 * door, not content. What a link preview shows is only the owner's display
 * name, which is what they chose to hand out with it.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  const link = await resolveInboxLink(code);
  const title = link ? `Send ${link.ownerName} a MoodStamp` : 'MoodStamp link';
  const description = link
    ? `Tell ${link.ownerName} how they made you feel: a feeling, counted in Medals or Rotten Eggs, with the reasons why. No account needed.`
    : 'A feeling, counted and sent on Skewvy.';
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description },
    twitter: { card: 'summary', title, description },
  };
}

export default async function MoodStampLinkRoute({ params }: Params) {
  const { code } = await params;
  const [link, user] = await Promise.all([resolveInboxLink(code), getCurrentUser()]);

  if (!link) {
    return (
      <LinkNotice
        title="This link does not work any more."
        body="Whoever shared it may have replaced it with a new one. Ask them for their current MoodStamp link."
      />
    );
  }

  if (user?.id === link.ownerId) {
    return (
      <LinkNotice
        title="This is your MoodStamp link."
        body="Share it, and whoever opens it can send you a MoodStamp. You cannot send one to yourself."
        action={{ href: '/moodstamps/receive', label: 'Manage your link' }}
      />
    );
  }

  if (link.paused) {
    return (
      <LinkNotice
        title={`${link.ownerName} is not taking MoodStamps right now.`}
        body="Their link is paused. Try again another time."
      />
    );
  }

  return (
    <Suspense fallback={null}>
      <LinkComposer
        code={code.trim().toLowerCase()}
        ownerName={link.ownerName}
        account={user ? { displayName: user.displayName } : null}
        turnstile={{ siteKey: turnstileSiteKey(), disabled: turnstileDisabled(), required: turnstileConfigured() }}
      />
    </Suspense>
  );
}

function LinkNotice({ title, body, action }: { title: string; body: string; action?: { href: string; label: string } }) {
  return (
    <div className="rail page-enter pb-[clamp(56px,7vw,110px)] pt-[clamp(40px,6vw,88px)]">
      <div className="max-w-[640px]">
        <p className="eyebrow text-[color:var(--color-violet)]">MoodStamp link</p>
        <h1 className="display mt-3 text-[clamp(30px,4vw,50px)]">{title}</h1>
        <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-secondary">{body}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {action && (
            <Link href={action.href} className="ms-key ms-cta w-full sm:w-auto">
              {action.label}
            </Link>
          )}
          <Link href="/" className="btn btn-outline min-h-[52px] w-full sm:w-auto">
            Go to Skewvy
          </Link>
        </div>
      </div>
    </div>
  );
}
