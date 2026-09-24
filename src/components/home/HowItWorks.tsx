import Link from 'next/link';
import { EggIcon, MedalIcon } from '@/components/ui/icons';

const STEPS = [
  {
    number: '01',
    mark: 'find' as const,
    tone: 'var(--color-indigo-soft)',
    title: 'Find a topic',
    body: 'A release, a policy, a rebrand nobody asked for. Profiles hold the long view; Stories cover the incident.',
  },
  {
    number: '02',
    mark: 'egg' as const,
    tone: 'var(--color-egg-deep)',
    title: 'Pick your side',
    body: "Eggs for the ones who earned them, medals for the ones who didn't deserve the eggs. Your side counts you once. On a Story it stays put; on a Profile you can change your mind later.",
  },
  {
    number: '03',
    mark: 'medal' as const,
    tone: 'var(--color-medal-deep)',
    title: 'Watch the number move',
    body: 'Hold the button down. The total is taps, not people, and it shows.',
  },
];

/**
 * The explanation, stated once and briefly.
 *
 * The rule under the heavy rule at the bottom is the one thing on this page a
 * visitor genuinely has to understand, so it is set at body-bold on its own
 * line rather than buried in the steps above it.
 */
export function HowItWorks() {
  return (
    <section id="how-it-works" className="rail scroll-mt-24">
      <div className="paper p-[clamp(22px,3vw,52px)]">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="display-sm m-0 text-[clamp(26px,3.2vw,46px)]">Three taps and you&apos;re in</h2>
          <p className="eyebrow-ink">No manifesto, promise</p>
        </div>

        <ol className="mt-[clamp(20px,2.6vw,38px)] grid gap-x-[clamp(24px,3vw,48px)] gap-y-8 md:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.number}>
              <div className="flex items-center gap-3">
                <span className="numeric-lg text-[26px]" style={{ color: step.tone }}>
                  {step.number}
                </span>
                <span aria-hidden="true" className="h-px flex-1 bg-[var(--rule-default)]" />
                <StepMark mark={step.mark} />
              </div>

              <h3 className="mt-4 text-[17px] font-extrabold leading-tight">{step.title}</h3>
              <p className="mt-2.5 max-w-[34ch] text-[14.5px] leading-[1.5] text-secondary">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-[clamp(24px,3vw,44px)] flex flex-wrap items-center justify-between gap-5 border-t-2 border-ink pt-[clamp(18px,2.2vw,28px)]">
          <p className="m-0 max-w-[48ch] text-[clamp(15px,1.2vw,18px)] font-bold leading-[1.45]">
            Reactions count taps. Opinions count people. One side per person per item — final on a Story, changeable on a Profile.
          </p>

          <Link
            href="/flash-news"
            className="border-b-2 border-[color:var(--color-indigo)] pb-1 text-[14px] font-bold leading-none"
          >
            See a live item →
          </Link>
        </div>
      </div>
    </section>
  );
}

/** The glyph closing each step's rule. */
function StepMark({ mark }: { mark: 'find' | 'egg' | 'medal' }) {
  if (mark === 'egg') return <EggIcon size={18} />;
  if (mark === 'medal') return <MedalIcon size={18} />;
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className="flex-none text-[color:var(--color-indigo)]"
    >
      <circle cx="7.75" cy="7.75" r="5" stroke="currentColor" strokeWidth="2.4" />
      <path d="M11.5 11.5L15.5 15.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
