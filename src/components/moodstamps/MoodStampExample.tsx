import Image from 'next/image';
import medalsExample from '@/assets/moodstamps/example-medals.png';
import eggsExample from '@/assets/moodstamps/example-rotten-eggs.png';

const EXAMPLES = {
  medals: {
    src: medalsExample,
    alt: 'Example MoodStamp from Pranav to Aarav: "You left me impressed" — 45 Medals, marked personal appreciation. What you did: "You stayed late to help me finish the presentation." Why it mattered: "I felt supported when I was under pressure." What I want you to know: "Your effort did not go unnoticed. Thank you."',
  },
  eggs: {
    src: eggsExample,
    alt: 'Example MoodStamp from an anonymous, Skewvy-verified sender to Aarav: "This made me feel fed up" — 45 Rotten Eggs, marked constructive criticism. What happened: "You changed the project deadline without informing the team." How it affected me: "I had to cancel other plans and work late." What I need next time: "Please communicate changes before they are finalized."',
  },
} as const;

/**
 * The supplied example MoodStamps, shown whole.
 *
 * The front stamp is never cropped — the feeling, the count and the reasons
 * are the point of it — and is held at a width where its reasons stay
 * readable. The other example is tucked behind it at an angle, decorative
 * only, so the pair reads as the start of a collection. Behind-stamp and
 * shadow both overhang; the figure clips them so a phone never scrolls
 * sideways.
 */
export function MoodStampExample({ lead }: { lead: 'medals' | 'eggs' }) {
  const front = EXAMPLES[lead];
  const behind = EXAMPLES[lead === 'medals' ? 'eggs' : 'medals'];

  return (
    <figure className="ms-example">
      <div aria-hidden="true" className="ms-example-behind hidden sm:block">
        <Image src={behind.src} alt="" sizes="330px" placeholder="blur" />
      </div>

      <div className="ms-example-in relative">
        <div className="ms-example-frame" style={{ '--ms-tilt': lead === 'medals' ? '-2deg' : '1.8deg' } as React.CSSProperties}>
          <Image
            src={front.src}
            alt={front.alt}
            sizes="(min-width: 1024px) 420px, (min-width: 640px) 60vw, 88vw"
            placeholder="blur"
            priority
          />
        </div>
      </div>

      <figcaption className="ms-example-label">Example MoodStamp</figcaption>
    </figure>
  );
}
