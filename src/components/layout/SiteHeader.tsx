'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SkewvyLogo } from './SkewvyLogo';
import type { PublicUser } from '@/lib/domain/types';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/flash-news', label: 'Flash News' },
  { href: '/entities', label: 'Entities' },
  { href: '/trending', label: 'Trending' },
];

export function SiteHeader({ user }: { user: PublicUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.refresh();
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        scrolled ? 'border-white/10 bg-ink-900/85 backdrop-blur-xl' : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="shrink-0" aria-label="Skewvy home">
          <SkewvyLogo />
        </Link>

        <nav aria-label="Primary" className="ml-4 hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                isActive(item.href) ? 'bg-white/10 text-chalk' : 'text-haze hover:bg-white/6 hover:text-chalk'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/search"
            aria-label="Search Skewvy"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/12 text-haze transition-colors hover:border-white/25 hover:text-chalk"
          >
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M13 13L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </Link>

          {user ? (
            <div className="hidden items-center gap-2 sm:flex">
              {user.isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-full border border-white/12 px-3.5 py-2 text-sm font-medium text-haze transition-colors hover:border-white/25 hover:text-chalk"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/profile"
                className="rounded-full border border-white/12 px-3.5 py-2 text-sm font-medium text-chalk-dim transition-colors hover:border-white/25 hover:text-chalk"
              >
                {user.displayName}
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="rounded-full px-3 py-2 text-sm font-medium text-haze transition-colors hover:text-chalk"
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href={`/login?redirectTo=${encodeURIComponent(pathname)}`}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-haze transition-colors hover:text-chalk"
              >
                Log in
              </Link>
              <Link
                href={`/register?redirectTo=${encodeURIComponent(pathname)}`}
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-bright"
              >
                Enter the heat
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/12 text-chalk-dim md:hidden"
          >
            <span className="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              {menuOpen ? (
                <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              ) : (
                <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-nav" className="border-t border-white/10 bg-ink-900/95 backdrop-blur-xl md:hidden">
          <nav aria-label="Mobile" className="mx-auto flex w-full max-w-[1400px] flex-col gap-1 px-4 py-4">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-4 py-3 text-base font-medium ${
                  isActive(item.href) ? 'bg-white/10 text-chalk' : 'text-haze'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link href="/search" className="rounded-xl px-4 py-3 text-base font-medium text-haze">
              Search
            </Link>

            <div className="mt-2 border-t border-white/10 pt-3">
              {user ? (
                <>
                  <Link href="/profile" className="block rounded-xl px-4 py-3 text-base font-medium text-chalk-dim">
                    {user.displayName}
                  </Link>
                  {user.isAdmin && (
                    <Link href="/admin" className="block rounded-xl px-4 py-3 text-base font-medium text-haze">
                      Admin
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={signOut}
                    className="block w-full rounded-xl px-4 py-3 text-left text-base font-medium text-haze"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2 px-1">
                  <Link
                    href={`/login?redirectTo=${encodeURIComponent(pathname)}`}
                    className="rounded-xl border border-white/12 px-4 py-3 text-center text-base font-medium text-chalk-dim"
                  >
                    Log in
                  </Link>
                  <Link
                    href={`/register?redirectTo=${encodeURIComponent(pathname)}`}
                    className="rounded-xl bg-brand px-4 py-3 text-center text-base font-semibold text-white"
                  >
                    Enter the heat
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
