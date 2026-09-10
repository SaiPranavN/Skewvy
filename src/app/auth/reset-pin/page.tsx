import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/AuthShell';
import { ResetPinFlow } from '@/components/auth/ResetPinFlow';
import { turnstileSiteKey, turnstileDisabled } from '@/lib/services/turnstile';

export const metadata: Metadata = { title: 'Reset your PIN' };
export const dynamic = 'force-dynamic';

export default async function ResetPinPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <AuthShell
      eyebrow="Forgot PIN"
      title="Set a new one and carry on."
      intro="We send a one-click link to your verified email address. Choosing a new PIN signs out every existing session."
    >
      <ResetPinFlow siteKey={turnstileSiteKey()} turnstileDisabled={turnstileDisabled()} token={token ?? null} />
    </AuthShell>
  );
}
