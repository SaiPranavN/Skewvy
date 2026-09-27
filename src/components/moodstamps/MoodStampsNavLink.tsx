import Link from 'next/link';
import { StampMark } from './icons';

/**
 * The masthead's way into MoodStamps.
 *
 * It is drawn as a label rather than a text link on purpose: every other item
 * in the navigation leads to a public list, and this one leads to something
 * private and personal. When already inside MoodStamps it turns to paper —
 * same size, same place — and says so to assistive technology too.
 */
export function MoodStampsNavLink({ active }: { active: boolean }) {
  return (
    <Link href="/moodstamps" aria-current={active ? 'page' : undefined} className="ms-key ms-nav">
      <StampMark className="ms-nav-mark" />
      MoodStamps
    </Link>
  );
}
