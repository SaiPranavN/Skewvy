import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin, getCurrentUser } from '@/lib/auth/current-user';
import { countOpenReports } from '@/lib/services/comments';

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/entities', label: 'Profiles' },
  { href: '/admin/flash-news', label: 'Stories' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/accounts', label: 'Accounts' },
];

/**
 * Admin shell. Access is re-checked here and again inside every action, so a
 * direct POST from a non-admin session is refused regardless of the UI.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The report count is cheap and only shown to an admin, so it is fetched
  // alongside the admin check rather than after it.
  const [admin, openReports] = await Promise.all([requireAdmin(), countOpenReports()]);

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
              {item.href === '/admin/reports' && openReports > 0 && (
                <span className="ml-1.5 bg-[color:var(--color-egg)] px-1.5 py-0.5 text-[11px] font-bold text-[color:var(--color-ink)]">
                  {openReports}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>

      {children}
    </div>
  );
}
