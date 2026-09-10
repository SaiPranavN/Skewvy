import Link from 'next/link';
import { SkewvyLogo } from '@/components/layout/SkewvyLogo';

/** Shared frame for the standalone auth pages. */
export function AuthShell({
  eyebrow,
  title,
  intro,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_minmax(0,420px)] lg:items-center lg:gap-16 lg:py-20">
      <div className="hidden lg:block">
        <Link href="/" className="mb-8 inline-block">
          <SkewvyLogo />
        </Link>
        <p className="label-caps mb-4 text-brand-bright">{eyebrow}</p>
        <h1 className="text-balance text-5xl font-black leading-[1.02] tracking-[-0.035em] text-chalk">{title}</h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-haze">{intro}</p>
        {aside}
      </div>

      <div className="glass-strong rounded-[28px] p-6 sm:p-8">
        <div className="mb-6 lg:hidden">
          <p className="label-caps mb-2 text-brand-bright">{eyebrow}</p>
          <h1 className="text-balance text-3xl font-black leading-tight tracking-[-0.03em] text-chalk">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-haze">{intro}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
