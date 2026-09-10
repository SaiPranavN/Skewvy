import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin, getCurrentUser } from '@/lib/auth/current-user';

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/entities', label: 'Entities' },
  { href: '/admin/flash-news', label: 'Flash News' },
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
        <p className="emoji text-4xl" aria-hidden="true">
          🔒
        </p>
        <h1 className="mt-4 text-2xl font-bold text-chalk">Administrator access required</h1>
        <p className="mt-3 text-sm leading-relaxed text-haze">
          This account does not have the admin flag. Add the address to <code className="text-chalk-dim">ADMIN_EMAILS</code>{' '}
          and register again, or grant the flag directly in the database.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-bright"
        >
          Back to Skewvy
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <div>
          <p className="label-caps text-brand-bright">Admin</p>
          <h1 className="mt-1 text-2xl font-bold text-chalk">Content management</h1>
        </div>

        <nav aria-label="Admin sections" className="ml-auto flex flex-wrap gap-1">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-white/12 px-4 py-2 text-sm font-medium text-haze transition-colors hover:border-white/28 hover:text-chalk"
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
