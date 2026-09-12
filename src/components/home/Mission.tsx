/**
 * What Skewvy is for, in three passes: the feeling, the mechanic, the numbers.
 *
 * Each is a plain editorial block rather than a decorated card — the point is
 * that someone who has never seen the product understands it before scrolling
 * past.
 */

const PILLARS = [
  {
    emoji: '🥚',
    title: 'When something frustrates you',
    body: 'A fee that appeared out of nowhere. A delay with no explanation. A decision made over your head. Send Rotten Eggs, as many as it takes, and watch the number grow.',
    tone: 'egg' as const,
  },
  {
    emoji: '🏅',
    title: 'When something deserves credit',
    body: 'A company that reversed course. A club that showed up. Work nobody was obliged to do. Award Medals, and put recognition on the same public record as the criticism.',
    tone: 'medal' as const,
  },
];

const MECHANICS = [
  {
    label: 'Reactions',
    heading: 'How strongly you feel',
    body: 'Every tap is counted. Tap once or three hundred times — the total measures the intensity behind a reaction, not just the fact of it.',
  },
  {
    label: 'Opinion',
    heading: 'How many people feel it',
    body: 'However many times you react, you count as exactly one person on one side. That is the number that says whether a crowd is split or united.',
  },
];

export function Mission() {
  return (
    <div className="space-y-20">
      <section aria-labelledby="mission-heading" className="mx-auto max-w-3xl text-center">
        <h2
          id="mission-heading"
          className="text-balance text-[1.75rem] font-medium leading-tight tracking-[-0.025em] text-primary sm:text-[2.25rem]"
        >
          Public feeling is real. It is almost never counted.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-[0.9375rem] leading-relaxed text-secondary sm:text-base">
          Anger and appreciation usually vanish into comment sections, group chats and threads nobody reads twice.
          Skewvy gives both a place to land and a number attached — so the reaction to a decision is as legible as the
          decision itself.
        </p>
      </section>

      <section aria-labelledby="pillars-heading" className="grid gap-10 sm:grid-cols-2 sm:gap-12">
        <h2 id="pillars-heading" className="sr-only">
          Two ways to react
        </h2>

        {PILLARS.map((pillar) => (
          <div key={pillar.title} className="border-t border-[var(--border-subtle)] pt-6">
            <span className="emoji text-2xl" aria-hidden="true">
              {pillar.emoji}
            </span>
            <h3
              className={`mt-4 text-lg font-medium ${pillar.tone === 'egg' ? 'text-egg' : 'text-medal'}`}
            >
              {pillar.title}
            </h3>
            <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-secondary">{pillar.body}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="mechanics-heading">
        <div className="mb-8 max-w-2xl">
          <h2
            id="mechanics-heading"
            className="text-balance text-[1.5rem] font-medium tracking-[-0.02em] text-primary sm:text-[1.875rem]"
          >
            Two numbers, measuring two different things
          </h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-secondary">
            Most platforms collapse these into one figure, and the figure means nothing as a result. Skewvy keeps them
            apart on every page.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 sm:gap-12">
          {MECHANICS.map((item) => (
            <div key={item.label} className="border-t border-[var(--border-subtle)] pt-6">
              <p className="eyebrow">{item.label}</p>
              <h3 className="mt-3 text-lg font-medium text-primary">{item.heading}</h3>
              <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-secondary">{item.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 border-l border-[var(--border-default)] pl-4 text-[0.9375rem] leading-relaxed text-tertiary">
          One more rule worth knowing before you start: your side is yours to pick once. After your first reaction to
          something, you can keep adding to it — but you cannot cross the floor.
        </p>
      </section>

      <section aria-labelledby="scope-heading" className="border-t border-[var(--border-subtle)] pt-10">
        <h2 id="scope-heading" className="text-lg font-medium text-primary">
          What gets reacted to
        </h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <h3 className="text-sm font-medium text-primary">Flash News</h3>
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              A specific event: an announcement, a price change, a release, a comeback. It carries its own reaction
              totals from the moment it is published.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-primary">Entities</h3>
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              A company, club, studio, product or public body. Sentiment accumulates across everything it does, so one
              good week does not erase a bad year.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-primary">Never people</h3>
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              Reactions are aimed at decisions, events and organisations. Skewvy is not a place to pile on a private
              individual, and it is not built to be one.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
