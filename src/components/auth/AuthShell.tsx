import Link from 'next/link';
import { Wordmark } from '@/components/layout/Wordmark';

/**
 * A focused, centred authentication panel. No slogan competing with the form,
 * no second column that carries no information.
 */
export function AuthShell({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[400px] flex-col px-4 py-10 sm:py-14">
      <Link href="/" aria-label="Skewvy home" className="mb-8 self-start">
        <Wordmark />
      </Link>

      <div className="panel p-5 sm:p-6">
        <h1 className="text-lg font-medium tracking-[-0.01em] text-primary">{title}</h1>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-secondary">{intro}</p>
        {children}
      </div>

      {footer && <div className="mt-5 text-xs leading-relaxed text-tertiary">{footer}</div>}
    </div>
  );
}
