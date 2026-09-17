import Link from 'next/link';
import { Wordmark } from '@/components/layout/Wordmark';

/**
 * A focused, centred authentication panel. No slogan competing with the form,
 * no second column that carries no information.
 *
 * The panel is a slab — cream paper, thick ink edge, hard orange shadow — so
 * signing in reads as the same kind of object as sending a reaction rather
 * than as a settings dialog.
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
    <div className="mx-auto flex w-full max-w-[440px] flex-col px-4 py-10 sm:py-14">
      <Link href="/" aria-label="Skewvy home" className="mb-8 self-start">
        <Wordmark size="sm" />
      </Link>

      <div className="slab p-5 sm:p-7">
        <h1 className="display-sm m-0 text-[clamp(26px,3vw,34px)]">{title}</h1>
        <p className="mb-6 mt-2.5 text-[14.5px] leading-[1.5] text-[rgb(23_20_15_/_0.68)]">{intro}</p>
        {children}
      </div>

      {footer && <div className="mt-6 text-xs leading-relaxed text-tertiary">{footer}</div>}
    </div>
  );
}
