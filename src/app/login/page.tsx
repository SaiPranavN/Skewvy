import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { LoginForm } from '@/components/auth/AuthForms';
import { turnstileSiteKey, turnstileDisabled, turnstileConfigured } from '@/lib/services/turnstile';
import { getCurrentUser } from '@/lib/auth/current-user';
import { safeRedirect } from '@/lib/api/request-context';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redirectTo?: string }> }) {
  const { redirectTo } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(safeRedirect(redirectTo, '/'));

  return (
    <div className="page-enter">
      <AuthShell
        title="Sign in"
        intro="Sign in to keep your reactions, track your opinion and continue where you left off."
        footer="Signing in from a device we have not seen before needs one email confirmation. After that, your email and PIN are enough."
      >
        <LoginForm
          siteKey={turnstileSiteKey()}
          turnstileDisabled={turnstileDisabled()}
          turnstileRequired={turnstileConfigured()}
          redirectTo={safeRedirect(redirectTo, '/')}
        />
      </AuthShell>
    </div>
  );
}
