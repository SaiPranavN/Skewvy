import type { ArtifactTotals } from './types';

/**
 * Editorial copy lives here so the tone stays consistent and reviewable in one
 * place. Heat is aimed at events, decisions, products and organisations —
 * never at private individuals or vulnerable groups.
 */

export const HERO_HEADLINE = 'No press release survives the crowd.';

export const HERO_SUPPORT =
  'Send Rotten Eggs when the internet deserves an explanation. Give Medals when someone actually gets it right. Every tap turns public mood into a number nobody can spin.';

/** Rotated across featured content so the same line never repeats on one screen. */
export const HEAT_LINES = [
  'Put it on trial. One tap at a time.',
  'The internet has entered the chat—and brought eggs.',
  'Applause is cute. Public heat is louder.',
  'Give flowers to the winners. Feed the rest to the egg counter.',
  'Every headline gets the crowd it deserves.',
  'Praise it. Roast it. Make the numbers hurt.',
  'Where bad decisions meet their breakfast.',
  'The public mood has receipts.',
  'Turn the outrage into a scoreboard.',
  'No takes. Just heat.',
  'If it deserves smoke, send eggs.',
  'The crowd is watching. The counter is unforgiving.',
  'Some stories earn medals. Some get breakfast.',
  'Bring your applause. Bring your ammunition.',
] as const;

export const EGG_LABELS = [
  'Add to the pile',
  'Turn up the heat',
  'Serve the backlash',
] as const;

export const MEDAL_LABELS = [
  'Reward the rare W',
  'Crown the comeback',
  'Give credit where it’s due',
] as const;

export const ARTIFACT_MICROCOPY = [
  'Add to the pile.',
  'Make the counter sweat.',
  'Reward the rare W.',
  'Give credit where it’s due.',
  'The crowd is watching.',
  'Your tap counts.',
] as const;

export const RECEIPT_CAPTIONS = [
  'The crowd has spoken.',
  'Currently catching heat.',
  'Medals awarded by the public.',
  'The numbers are not subtle.',
] as const;

/** Deterministic pick so server and client renders agree. */
export function pickFrom<T>(list: readonly T[], seed: string): T {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return list[hash % list.length];
}

export type SentimentState = 'heat' | 'flowers' | 'split' | 'quiet' | 'cooked' | 'fresh';

export interface SentimentLabel {
  state: SentimentState;
  label: string;
  tone: 'egg' | 'medal' | 'split' | 'neutral';
}

/**
 * Describes which way a crowd is leaning. Uses reaction volume for intensity and
 * opinion counts for the split, and never mixes the two into one number.
 */
export function sentimentLabel(totals: ArtifactTotals): SentimentLabel {
  const reactions = totals.rottenEggTotal + totals.medalTotal;
  if (reactions < 200) return { state: 'fresh', label: 'Freshly on trial', tone: 'neutral' };

  const eggShare = totals.rottenEggTotal / reactions;
  if (eggShare >= 0.78) return { state: 'cooked', label: 'Publicly cooked', tone: 'egg' };
  if (eggShare >= 0.6) return { state: 'heat', label: 'Catching heat', tone: 'egg' };
  if (eggShare <= 0.22) return { state: 'flowers', label: 'Getting its flowers', tone: 'medal' };
  if (eggShare <= 0.4) return { state: 'quiet', label: 'Quietly winning', tone: 'medal' };
  return { state: 'split', label: 'Crowd split', tone: 'split' };
}

/** Short leaderboard captions. */
export function leaderboardTag(rank: number, board: 'heat' | 'medals'): string {
  if (board === 'heat') return ['Most cooked', 'Taking the L', 'Feeling the heat'][rank] ?? 'On the pile';
  return ['Crowd favourite', 'Biggest comeback', 'Quietly winning'][rank] ?? 'Earning it';
}

export const CROWD_PULSE_LINES = {
  rotten_egg: ['{n} 🥚 just landed', 'The crowd added {n} eggs', '+{n} 🥚 from the crowd'],
  medal: ['+{n} 🏅 for the rare W', '{n} 🏅 just landed', 'The crowd added {n} medals'],
} as const;
