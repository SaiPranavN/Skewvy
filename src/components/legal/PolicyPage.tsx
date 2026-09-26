import Link from 'next/link';

export const POLICY_LINKS: Array<{ href: string; label: string }> = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/community-rules', label: 'Community Rules' },
  { href: '/report', label: 'Report' },
  { href: '/contact', label: 'Contact' },
];

/**
 * The shared frame for Skewvy's small set of plain-language pages: Terms,
 * Privacy, Community Rules, Report and Contact.
 *
 * Readable first. One column of roughly 760px, a modest title rather than the
 * display sizes the rest of the site shouts in, and a quiet row of links
 * between the five pages so each is one tap from the others.
 */
export function PolicyPage({
  current,
  title,
  effective,
  intro,
  children,
}: {
  current: string;
  title: string;
  /** e.g. "26 September 2026". Omitted for pages that are not policies. */
  effective?: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="page-enter rail pb-[clamp(40px,6vw,88px)] pt-[clamp(24px,3.4vw,52px)]">
      <div className="max-w-[760px]">
        <nav aria-label="About Skewvy" className="-ml-2 flex flex-wrap gap-x-1 gap-y-0.5">
          {POLICY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.href === current ? 'page' : undefined}
              className="policy-tab"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <header className="mt-[clamp(20px,2.6vw,32px)] border-b border-[var(--border-default)] pb-[clamp(18px,2.2vw,26px)]">
          <h1 className="display m-0 text-[clamp(30px,3.6vw,44px)] text-primary">{title}</h1>
          {effective && (
            <p className="m-0 mt-3 text-[12px] font-semibold uppercase leading-none tracking-[0.08em] text-tertiary">
              Effective {effective}
            </p>
          )}
          {intro && <div className="policy-prose mt-4">{intro}</div>}
        </header>

        <div className="policy-prose">{children}</div>
      </div>
    </div>
  );
}

export function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  const id = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return (
    <section aria-labelledby={id} className="mt-[clamp(28px,3.4vw,40px)]">
      <h2 id={id} className="m-0 text-[clamp(18px,1.5vw,21px)] font-extrabold leading-[1.25] tracking-[-0.01em] text-primary">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function MailLink() {
  return (
    <a href="mailto:team@skewvy.com" className="policy-link">
      team@skewvy.com
    </a>
  );
}
