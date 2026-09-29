import { EggMark, MedalMark } from './MoodStampMarks';

/**
 * What MoodStamps are for, told as moments rather than features. Illustrative
 * — nobody's real stamps — and shown only on an empty board, where someone is
 * still deciding whether this is for them.
 */
const MOMENTS = [
  {
    reaction: 'medal',
    moment: 'The friend who showed up at 2 a.m. and never once asked why.',
    feeling: 'Grateful',
    count: '50 Medals',
  },
  {
    reaction: 'rotten_egg',
    moment: 'The teammate who presented your late nights as their own work.',
    feeling: 'Hurt',
    count: '20 Rotten Eggs',
  },
  {
    reaction: 'medal',
    moment: 'The teacher who believed in you before you believed in yourself.',
    feeling: 'Inspired',
    count: '100 Medals',
  },
  {
    reaction: 'rotten_egg',
    moment: 'The plans that were cancelled at the last minute — again.',
    feeling: 'Let down',
    count: '8 Rotten Eggs',
  },
] as const;

export function MoodStampMoments() {
  return (
    <section aria-labelledby="moodstamp-moments" className="mt-[clamp(56px,7vw,96px)]">
      <h2 id="moodstamp-moments" className="display-sm text-[clamp(26px,3vw,38px)]">
        For the moments words usually fail.
      </h2>
      <p className="mt-3 max-w-[58ch] text-[15.5px] leading-[1.55] text-secondary">
        The thank-you you meant to say out loud. The frustration you keep swallowing. Say it once, clearly and kindly,
        and give them something they can keep.
      </p>

      <ul className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {MOMENTS.map((item) => (
          <li
            key={item.moment}
            className={`ms-moment ${item.reaction === 'medal' ? 'tone-medal' : 'tone-egg'}`}
          >
            <span className="ms-moment-mark" aria-hidden="true">
              {item.reaction === 'medal' ? <MedalMark /> : <EggMark />}
            </span>
            <p className="text-[16px] font-semibold leading-snug">{item.moment}</p>
            <p className="mt-auto pt-5 text-[12px] font-extrabold uppercase tracking-[0.12em]">
              {item.feeling} · {item.count}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
