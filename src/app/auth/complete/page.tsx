import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/AuthShell';
import { CompleteRegistrationForm } from '@/components/auth/AuthForms';
import { findPendingRegistration } from '@/lib/services/registration';
import { turnstileSiteKey, turnstileDisabled, turnstileConfigured } from '@/lib/services/turnstile';
import { safeRedirect } from '@/lib/api/request-context';

export const metadata: Metadata = { title: 'Finish setting up your account', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Step two of sign-up, reached from the emailed link.
 *
 * The token is checked here before the form renders, so a dead link says so
 * immediately rather than after someone has chosen a PIN and pressed submit.
 * It is only read at this point — burning it is what creates the account, and
 * that happens when the form is sent.
 */
export default async function CompleteRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; redirectTo?: string }>;
}) {
  const { token, redirectTo } = await searchParams;
  const lookup = token ? await findPendingRegistration(token) : ({ ok: false, reason: 'not_found' } as const);

  if (!lookup.ok) {
    return (
      <div className="page-enter">
        <AuthShell title="That link no longer works" intro={EXPLANATION[lookup.reason]}>
          <div className="space-y-3">
            <Link
              href="/register"
              className="flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] bg-primary px-4 text-sm font-medium text-ground transition-opacity duration-150 hover:opacity-90"
            >
              Start again
            </Link>
            <Link
              href="/login"
              className="flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-default)] px-4 text-sm text-primary transition-colors duration-150 hover:border-[var(--border-strong)]"
            >
              I already have an account
            </Link>
          </div>
        </AuthShell>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <AuthShell
        title="Choose your PIN"
        intro={`Your email is confirmed. One more step and ${lookup.pending.displayName} is ready to react.`}
        footer="Your PIN is hashed with Argon2id and never stored in a form we can read."
      >
        <CompleteRegistrationForm
          token={token!}
          displayName={lookup.pending.displayName}
          email={lookup.pending.email}
          redirectTo={safeRedirect(redirectTo ?? lookup.pending.redirectTo, '/')}
          siteKey={turnstileSiteKey()}
          turnstileDisabled={turnstileDisabled()}
          turnstileRequired={turnstileConfigured()}
        />
      </AuthShell>
    </div>
  );
}

const EXPLANATION: Record<'not_found' | 'expired' | 'already_used', string> = {
  not_found: 'We could not find that sign-up. The link may have been mistyped, or a newer one has replaced it.',
  expired: 'Confirmation links last 60 minutes. Start again and we will send a fresh one.',
  already_used: 'That link has already been used, which means the account exists. Sign in with your email and PIN.',
};
