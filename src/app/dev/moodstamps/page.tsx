import { notFound } from 'next/navigation';
import { MoodStampStates } from './MoodStampStates';

/**
 * A visual bench for the MoodStamp board.
 *
 * Nobody can send a MoodStamp yet, so a real board is always empty — the only
 * way to look at populated cards, loading, errors and offline is to render
 * them from sample data here. Development only: it never reaches a deployed
 * build, and the sample records never touch anyone's board.
 */
export const dynamic = 'force-dynamic';

export default function MoodStampsDevPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <MoodStampStates />;
}
