import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { LoginForm } from '@/components/auth/AuthForms';
import { turnstileSiteKey, turnstileDisabled } from '@/lib/services/turnstile';
import { getCurrentUser } from '@/lib/auth/current-user';
import { safeRedirect } from '@/lib/api/request-context';

export const metadata: Metadata = { title: 'Log in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(safeRedirect(redirectTo, '/'));

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="The crowd is watching. The counter is unforgiving."
      intro="Email and PIN. No inbox trip unless we see something unusual."
      aside={
        <p className="mt-8 max-w-md text-sm leading-relaxed text-haze-dim">
          If you sign in from a device we have not seen before, we will ask you to confirm it once by email. That is
          the exception, not the routine.
        </p>
      }
    >
      <LoginForm
        siteKey={turnstileSiteKey()}
        turnstileDisabled={turnstileDisabled()}
        redirectTo={safeRedirect(redirectTo, '/')}
      />
    </AuthShell>
  );
}
