import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AccountsTable } from '@/components/admin/AccountsTable';
import { AdminSearch } from '@/components/admin/AdminSearch';
import { requireAdmin } from '@/lib/auth/current-user';
import { listAccounts } from '@/lib/services/accounts';
import { formatCount } from '@/lib/domain/format';

export const metadata: Metadata = { title: 'Accounts' };
export const dynamic = 'force-dynamic';

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; offset?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect('/login?redirectTo=/admin/accounts');

  const { q, offset } = await searchParams;
  const parsedOffset = Number.parseInt(offset ?? '0', 10);

  const page = await listAccounts({
    search: q ?? null,
    offset: Number.isFinite(parsedOffset) ? parsedOffset : 0,
  });

  const suspended = page.accounts.filter((account) => account.suspendedAt).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium tracking-[-0.01em] text-primary">Accounts</h1>
          <p className="mt-1 text-sm text-secondary">
            {formatCount(page.total)} account{page.total === 1 ? '' : 's'}
            {suspended > 0 ? ` · ${suspended} suspended on this page` : ''}
          </p>
        </div>
        <AdminSearch basePath="/admin/accounts" initialValue={q ?? ''} />
      </div>

      <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-surface px-4 py-3">
        <p className="text-sm leading-relaxed text-secondary">
          <span className="text-primary">Suspending</span> signs someone out everywhere and blocks sign-in, keeping
          everything they wrote. It can be undone.{' '}
          <span className="text-primary">Deleting</span> removes the person and every reaction, opinion and comment they
          left — the public totals are recalculated to match, and none of it comes back.
        </p>
      </div>

      <AccountsTable accounts={page.accounts} viewerId={admin.id} />

      {page.nextOffset !== null && (
        <Link
          href={`/admin/accounts?${new URLSearchParams({ ...(q ? { q } : {}), offset: String(page.nextOffset) })}`}
          className="inline-flex min-h-10 items-center rounded-md border border-[var(--border-default)] px-4 text-sm text-secondary transition-colors duration-150 hover:border-[var(--border-strong)] hover:text-primary"
        >
          Show more accounts
        </Link>
      )}
    </div>
  );
}
