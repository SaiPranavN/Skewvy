'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Wordmark } from './Wordmark';
import type { PublicUser } from '@/lib/domain/types';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/flash-news', label: 'Flash News' },
  { href: '/entities', label: 'Entities' },
  { href: '/trending', label: 'Trending' },
];

/**
 * Masthead: wordmark left, navigation centred, account and primary action
 * right.
 *
 * Over the landing hero it sits transparent on the photograph and turns solid
 * once the page scrolls, so the image reads at full height on arrival.
 */
export function SiteHeader({ user }: { user: PublicUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const overHero = pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
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

  const transparent = overHero && !scrolled && !menuOpen;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-200 ${
        transparent ? 'border-transparent bg-transparent' : 'border-[var(--border-subtle)] bg-ground'
      }`}
    >
      <div className="mx-auto flex h-[68px] w-full max-w-[1440px] items-center px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="skewvy.com home" className="shrink-0">
          <Wordmark />
        </Link>

        {/* Centred navigation, absolutely placed so it stays centred whatever
            the width of the two side groups. */}
        <nav
          aria-label="Primary"
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative px-3.5 py-2 text-sm transition-colors duration-150 ${
                  active ? 'text-primary' : 'text-secondary hover:text-primary'
                }`}
              >
                {item.label}
                {active && <span aria-hidden="true" className="absolute inset-x-3.5 -bottom-px h-px bg-brand" />}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/search"
            aria-label="Search"
            className="grid h-10 w-10 place-items-center rounded-md text-secondary transition-colors duration-150 hover:text-primary"
          >
            <SearchIcon />
          </Link>

          {user ? (
            <div className="hidden items-center gap-2 sm:flex">
              {user.isAdmin && (
                <Link
                  href="/admin"
                  className="px-3 py-2 text-sm text-secondary transition-colors duration-150 hover:text-primary"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/profile"
                className="rounded-md border border-[var(--border-default)] px-3.5 py-2 text-sm text-primary transition-colors duration-150 hover:border-[var(--border-strong)]"
              >
                {user.displayName}
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="px-2.5 py-2 text-sm text-tertiary transition-colors duration-150 hover:text-primary"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href={`/login?redirectTo=${encodeURIComponent(pathname)}`}
                className="px-3 py-2 text-sm text-secondary transition-colors duration-150 hover:text-primary"
              >
                Sign in
              </Link>
              {/* Straight to the catalogue. Signing in has its own control beside this. */}
              <Link
                href="/flash-news"
                className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium uppercase tracking-[0.04em] text-ground transition-opacity duration-150 hover:opacity-90"
              >
                Get started
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            className="grid h-10 w-10 place-items-center rounded-md text-secondary transition-colors duration-150 hover:text-primary md:hidden"
          >
            <span className="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span>
            <MenuIcon open={menuOpen} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-nav" className="border-t border-[var(--border-subtle)] bg-ground md:hidden">
          <nav aria-label="Mobile" className="mx-auto w-full max-w-[1440px] px-4 py-2 sm:px-6">
            {[...NAV_ITEMS, { href: '/search', label: 'Search' }].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-11 items-center border-b border-[var(--border-subtle)] py-3 text-[0.9375rem] last:border-0 ${
                  isActive(item.href) ? 'text-primary' : 'text-secondary'
                }`}
              >
                {item.label}
              </Link>
            ))}

            <div className="divider mt-2 flex flex-wrap items-center gap-2 py-4">
              {user ? (
                <>
                  <Link
                    href="/profile"
                    className="rounded-md border border-[var(--border-default)] px-3.5 py-2.5 text-sm text-primary"
                  >
                    {user.displayName}
                  </Link>
                  {user.isAdmin && (
                    <Link href="/admin" className="px-3 py-2.5 text-sm text-secondary">
                      Admin
                    </Link>
                  )}
                  <button type="button" onClick={signOut} className="px-3 py-2.5 text-sm text-tertiary">
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/flash-news"
                    className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium uppercase tracking-[0.04em] text-ground"
                  >
                    Get started
                  </Link>
                  <Link
                    href={`/login?redirectTo=${encodeURIComponent(pathname)}`}
                    className="px-3 py-2.5 text-sm text-secondary"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function SearchIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="7.75" cy="7.75" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11.5 11.5L15.5 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      {open ? (
        <path d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ) : (
        <path d="M2.5 5.5h13M2.5 12.5h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      )}
    </svg>
  );
}
