import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '@/components/auth/AuthShell';
import { VerifyClient } from '@/components/auth/VerifyClient';

export const metadata: Metadata = { title: 'Confirm your email', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; redirectTo?: string }>;
}) {
  const { token, redirectTo } = await searchParams;

  return (
    <div className="page-enter">
      <AuthShell
        title="Confirming your email"
        intro="This is the only time you need your inbox to sign in."
      >
        <Suspense fallback={<div className="skeleton h-24" />}>
          <VerifyClient token={token ?? null} redirectTo={redirectTo ?? null} />
        </Suspense>
      </AuthShell>
    </div>
  );
}
