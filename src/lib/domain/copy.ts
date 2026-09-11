import type { ArtifactTotals } from './types';

/**
 * Editorial copy lives here so the tone stays consistent and reviewable.
 *
 * The rule: marketing surfaces may be sharp, but anything that labels data is
 * factual and credible. A sentiment label describes a measurement, never a
 * verdict on a person.
 */

export const HERO_HEADLINE = 'Public sentiment, counted.';

export const HERO_SUPPORT =
  'React to the stories, decisions and entities shaping the moment. Send Rotten Eggs when something deserves criticism. Award Medals when it deserves recognition.';

/** The distinction the whole product rests on. Stated plainly, everywhere. */
export const MEASUREMENT_PRINCIPLE =
  'Every tap adds to the reaction total. Every person counts once in the public opinion.';

export const MEASUREMENT_NOTE =
  'Reaction totals measure intensity. Public opinion counts each person once.';

export const EGG_ACTION = 'Send Rotten Eggs';
export const MEDAL_ACTION = 'Award Medals';

export type SentimentState =
  | 'strong-disapproval'
  | 'under-scrutiny'
  | 'divided'
  | 'approval'
  | 'strong-approval'
  | 'early';

export interface SentimentLabel {
  state: SentimentState;
  label: string;
  tone: 'egg' | 'medal' | 'neutral';
}

/**
 * Describes which way a crowd is leaning, using reaction volume for confidence
 * and the reaction mix for direction. Deliberately factual: these labels sit on
 * data, so they report rather than editorialise.
 */
export function sentimentLabel(totals: ArtifactTotals): SentimentLabel {
  const reactions = totals.rottenEggTotal + totals.medalTotal;
  if (reactions < 200) return { state: 'early', label: 'Early reaction', tone: 'neutral' };

  const eggShare = totals.rottenEggTotal / reactions;
  if (eggShare >= 0.78) return { state: 'strong-disapproval', label: 'Strong disapproval', tone: 'egg' };
  if (eggShare >= 0.6) return { state: 'under-scrutiny', label: 'Under scrutiny', tone: 'egg' };
  if (eggShare <= 0.22) return { state: 'strong-approval', label: 'Strong approval', tone: 'medal' };
  if (eggShare <= 0.4) return { state: 'approval', label: 'Broadly approved', tone: 'medal' };
  return { state: 'divided', label: 'Public opinion divided', tone: 'neutral' };
}

/** Section headings for the ranked surfaces. Descriptive, not promotional. */
export const SECTION_TITLES = {
  trending: 'Most active today',
  scrutiny: 'Entities under scrutiny',
  recognition: 'Earning recognition',
  latest: 'Latest Flash News',
  shifting: 'Sentiment shifting',
  fresh: 'Recently added',
} as const;

export const RECEIPT_CAPTIONS = [
  'Public sentiment, counted.',
  'Recorded by the public.',
  'The reaction so far.',
] as const;

/** Deterministic pick so server and client renders agree. */
export function pickFrom<T>(list: readonly T[], seed: string): T {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return list[hash % list.length];
}

/** Grouped remote activity, reported plainly. */
export function crowdSignal(reactionType: 'rotten_egg' | 'medal', formattedQuantity: string): string {
  return reactionType === 'rotten_egg'
    ? `+${formattedQuantity} Rotten Eggs`
    : `+${formattedQuantity} Medals`;
}
