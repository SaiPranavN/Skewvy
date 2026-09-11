import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { RegisterForm } from '@/components/auth/AuthForms';
import { turnstileSiteKey, turnstileDisabled, turnstileConfigured } from '@/lib/services/turnstile';
import { getCurrentUser } from '@/lib/auth/current-user';
import { safeRedirect } from '@/lib/api/request-context';

export const metadata: Metadata = { title: 'Create an account' };
export const dynamic = 'force-dynamic';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ redirectTo?: string }> }) {
  const { redirectTo } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(safeRedirect(redirectTo, '/'));

  return (
    <div className="page-enter">
      <AuthShell
        title="Create an account"
        intro="Confirm your email once, then choose a PIN. Your reactions and your opinion stay with the account."
        footer="Your PIN is hashed with Argon2id and never stored, logged or sent back in plain text."
      >
        <RegisterForm
          siteKey={turnstileSiteKey()}
          turnstileDisabled={turnstileDisabled()}
          turnstileRequired={turnstileConfigured()}
          redirectTo={safeRedirect(redirectTo, '/')}
        />
      </AuthShell>
    </div>
  );
}
