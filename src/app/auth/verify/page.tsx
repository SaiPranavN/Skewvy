import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '@/components/auth/AuthShell';
import { VerifyClient } from '@/components/auth/VerifyClient';

export const metadata: Metadata = { title: 'Verify your email' };
export const dynamic = 'force-dynamic';

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; redirectTo?: string }>;
}) {
  const { token, redirectTo } = await searchParams;

  return (
    <AuthShell
      eyebrow="Almost in"
      title="One tap to confirm."
      intro="We are checking your link. This is the only time you will need your inbox to sign in."
    >
      <Suspense fallback={<div className="skeleton h-40 rounded-2xl" />}>
        <VerifyClient token={token ?? null} redirectTo={redirectTo ?? null} />
      </Suspense>
    </AuthShell>
  );
}
