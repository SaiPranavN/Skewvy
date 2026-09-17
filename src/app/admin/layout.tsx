import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin, getCurrentUser } from '@/lib/auth/current-user';

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/entities', label: 'Entities' },
  { href: '/admin/flash-news', label: 'Flash News' },
  { href: '/admin/accounts', label: 'Accounts' },
];

/**
 * Admin shell. Access is re-checked here and again inside every action, so a
 * direct POST from a non-admin session is refused regardless of the UI.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  if (!admin) {
    const user = await getCurrentUser();
    if (!user) redirect('/login?redirectTo=%2Fadmin');

    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-24 text-center">
        <h1 className="display mt-4 text-[clamp(28px,4vw,44px)]">Administrator access required</h1>
        <p className="mt-4 text-sm leading-relaxed text-secondary">
          This account does not have the admin flag. Add the address to <code className="text-secondary">ADMIN_EMAILS</code>{' '}
          and register again, or grant the flag directly in the database.
        </p>
        <Link
          href="/"
          className="btn btn-paper mt-6 inline-flex"
        >
          Back to Skewvy
        </Link>
      </div>
    );
  }

  return (
    <div className="rail py-8">
      <div className="mb-8 flex flex-wrap items-center gap-4 border-b border-[var(--border-default)] pb-5">
        <div>
          <p className="eyebrow text-brand">Admin</p>
          <h1 className="display mt-2 text-[clamp(30px,4vw,52px)]">Content management</h1>
        </div>

        <nav aria-label="Admin sections" className="ml-auto flex flex-wrap gap-0.5">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="border-b-[3px] border-transparent px-3 py-2.5 text-[13px] font-semibold leading-none text-tertiary transition-colors duration-150 hover:border-[var(--border-strong)] hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {children}
    </div>
  );
}
