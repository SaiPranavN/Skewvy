'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Wordmark } from './Wordmark';
import type { PublicUser } from '@/lib/domain/types';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/flash-news', label: 'Flash News' },
  { href: '/entities', label: 'Entities' },
  { href: '/trending', label: 'Leaderboards' },
];

/**
 * Masthead: wordmark, navigation, account.
 *
 * It sticks rather than floats, so no page has to reserve space under it. The
 * active tab is marked by a 3px orange rule sitting on the header's own
 * bottom edge. Everything wraps — at narrow widths the navigation drops to its
 * own line rather than collapsing into a menu.
 */
export function SiteHeader({ user }: { user: PublicUser | null }) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.refresh();
  };

  return (
    <header
      className="sticky top-0 z-[60] border-b border-[var(--border-default)] backdrop-blur-[8px]"
      style={{ backgroundColor: 'rgba(20,17,15,.94)' }}
    >
      <div className="rail flex flex-wrap items-center gap-[clamp(14px,2vw,30px)] py-3.5">
        <Link href="/" aria-label="skewvy.com home" className="flex-none">
          <Wordmark />
        </Link>

        <nav aria-label="Primary" className="flex flex-wrap items-center gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`border-b-[3px] px-3 py-2.5 text-[13px] leading-none transition-colors duration-150 ${
                  active
                    ? 'border-brand font-bold text-primary'
                    : 'border-transparent font-semibold text-tertiary hover:border-[var(--border-strong)] hover:text-primary'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <HeaderSearch />

          {user ? (
            <>
              {user.isAdmin && (
                <Link
                  href="/admin"
                  className="text-[12.5px] font-semibold uppercase leading-none tracking-[0.06em] text-tertiary transition-colors duration-150 hover:text-primary"
                >
                  Admin
                </Link>
              )}
              <span className="hidden text-[12.5px] font-semibold leading-none tracking-[0.06em] text-tertiary sm:inline">
                Signed in
              </span>
              <Link
                href="/profile"
                className="bg-primary px-[13px] py-2.5 text-[13px] font-bold leading-none text-ground"
              >
                {user.displayName}
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="text-[12.5px] font-semibold uppercase leading-none tracking-[0.06em] text-tertiary transition-colors duration-150 hover:text-primary"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href={`/login?redirectTo=${encodeURIComponent(pathname)}`}
                className="text-[12.5px] font-semibold uppercase leading-none tracking-[0.06em] text-tertiary transition-colors duration-150 hover:text-primary"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="bg-primary px-[13px] py-2.5 text-[13px] font-bold leading-none text-ground transition-transform duration-150 active:translate-y-0.5"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Search in the masthead itself rather than behind an icon: it is the fastest
 * route to any item on the site, and hiding it behind a click costs more than
 * the width it takes. It collapses to the icon-sized field on a phone.
 */
function HeaderSearch() {
  const router = useRouter();
  const [value, setValue] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
  };

  return (
    <form onSubmit={submit} role="search" className="relative hidden sm:block">
      <label htmlFor="masthead-search" className="sr-only">
        Search topics
      </label>
      <SearchIcon />
      <input
        id="masthead-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search topics"
        className="field-dark min-h-10 w-[min(38vw,240px)] py-2 pl-10 pr-3 text-[13px]"
      />
    </form>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tertiary"
    >
      <circle cx="7.75" cy="7.75" r="5" stroke="currentColor" strokeWidth="2" />
      <path d="M11.5 11.5L15.5 15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
