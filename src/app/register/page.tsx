import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { RegisterForm } from '@/components/auth/AuthForms';
import { turnstileSiteKey, turnstileDisabled, turnstileConfigured } from '@/lib/services/turnstile';
import { requiresEmailVerification } from '@/lib/services/auth';
import { getCurrentUser } from '@/lib/auth/current-user';
import { safeRedirect } from '@/lib/api/request-context';

export const metadata: Metadata = { title: 'Create an account' };
export const dynamic = 'force-dynamic';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ redirectTo?: string }> }) {
  const { redirectTo } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(safeRedirect(redirectTo, '/'));

  const verifyByEmail = requiresEmailVerification();

  return (
    <div className="page-enter">
      <AuthShell
        title="Create an account"
        intro={
          verifyByEmail
            ? 'Confirm your email once, then choose a PIN. Your reactions and your opinion stay with the account.'
            : 'Pick a name, an email and a PIN. You are signed in straight away.'
        }
        footer={
          verifyByEmail
            ? 'Your PIN is hashed with Argon2id and never stored, logged or sent back in plain text.'
            : 'Your PIN is hashed with Argon2id and never stored in plain text. Email confirmation is off because no mail transport is configured — set RESEND_API_KEY to turn it on.'
        }
      >
        <RegisterForm
          siteKey={turnstileSiteKey()}
          turnstileDisabled={turnstileDisabled()}
          turnstileRequired={turnstileConfigured()}
          emailVerificationRequired={verifyByEmail}
          redirectTo={safeRedirect(redirectTo, '/')}
        />
      </AuthShell>
    </div>
  );
}
