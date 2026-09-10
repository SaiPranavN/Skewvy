import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { RegisterForm } from '@/components/auth/AuthForms';
import { turnstileSiteKey, turnstileDisabled } from '@/lib/services/turnstile';
import { getCurrentUser } from '@/lib/auth/current-user';
import { safeRedirect } from '@/lib/api/request-context';
import { PIN_MIN_LENGTH } from '@/lib/validation/schemas';

export const metadata: Metadata = { title: 'Create an account' };
export const dynamic = 'force-dynamic';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(safeRedirect(redirectTo, '/'));

  return (
    <AuthShell
      eyebrow="Join the crowd"
      title="Bring your applause. Bring your ammunition."
      intro="One email confirmation, then a PIN you choose. You will not need your inbox again after that."
      aside={
        <ul className="mt-8 space-y-3 text-sm text-haze">
          <li className="flex gap-3">
            <span className="emoji" aria-hidden="true">
              🥚
            </span>
            Send Rotten Eggs when a decision deserves an explanation.
          </li>
          <li className="flex gap-3">
            <span className="emoji" aria-hidden="true">
              🏅
            </span>
            Give Medals when someone actually gets it right.
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true">🔒</span>
            Your PIN is hashed and never stored, logged or returned in plain text.
          </li>
        </ul>
      }
    >
      <RegisterForm
        siteKey={turnstileSiteKey()}
        turnstileDisabled={turnstileDisabled()}
        redirectTo={safeRedirect(redirectTo, '/')}
      />

      <p className="mt-6 border-t border-white/8 pt-5 text-xs leading-relaxed text-haze-dim">
        Your PIN needs at least {PIN_MIN_LENGTH} characters and can be digits, letters or both. It is the credential
        you will use from now on, so pick something you will remember but nobody could guess.
      </p>
    </AuthShell>
  );
}
