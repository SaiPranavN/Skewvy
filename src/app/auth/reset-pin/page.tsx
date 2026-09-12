import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/AuthShell';
import { ResetPinFlow } from '@/components/auth/ResetPinFlow';
import { turnstileSiteKey, turnstileDisabled, turnstileConfigured } from '@/lib/services/turnstile';
import { requiresEmailVerification } from '@/lib/services/auth';

export const metadata: Metadata = { title: 'Reset your PIN' };
export const dynamic = 'force-dynamic';

export default async function ResetPinPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const verifyByEmail = requiresEmailVerification();

  return (
    <div className="page-enter">
      <AuthShell
        title={token ? 'Choose a new PIN' : 'Reset your PIN'}
        intro={
          token
            ? 'Setting a new PIN signs out every other session on your account.'
            : verifyByEmail
              ? 'We send a one-click link to your verified email address.'
              : 'Enter your email address and choose a new PIN. No confirmation email is sent.'
        }
      >
        <ResetPinFlow
          siteKey={turnstileSiteKey()}
          turnstileDisabled={turnstileDisabled()}
          turnstileRequired={turnstileConfigured()}
          token={token ?? null}
        />
      </AuthShell>
    </div>
  );
}
