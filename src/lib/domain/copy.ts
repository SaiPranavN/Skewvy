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

/**
 * The colour and label a card wears, derived from **people** rather than taps.
 *
 * This is the rule the whole product turns on. One furious person can send a
 * hundred Rotten Eggs while five quietly appreciative people send ten Medals
 * each; the reaction totals then say 100 against 50, and reading a verdict off
 * them would report the opposite of what the crowd actually thinks. So the
 * label and the colour are computed from the unique opinion counts alone, and
 * the tap totals are never consulted here.
 *
 * Orange means more people are critical, gold means more are appreciative,
 * indigo means neither — or that nobody has taken a side yet.
 */
export type CardTone = 'egg' | 'medal' | 'split';

export interface ToneBadge {
  tone: CardTone;
  /** Shown on a Flash News card — about one event. */
  flashLabel: string;
  /** Shown on an Entity card — about a standing record. */
  entityLabel: string;
}

export function cardTone(totals: ArtifactTotals): ToneBadge {
  const critical = totals.negativeOpinionTotal;
  const appreciative = totals.positiveOpinionTotal;
  const people = critical + appreciative;

  if (people === 0) {
    return { tone: 'split', flashLabel: 'No opinions yet', entityLabel: 'No record yet' };
  }

  const criticalShare = critical / people;

  if (criticalShare >= 0.6) return { tone: 'egg', flashLabel: 'Mostly criticized', entityLabel: 'Mostly criticized' };
  if (criticalShare <= 0.4) return { tone: 'medal', flashLabel: 'Mostly appreciated', entityLabel: 'Mostly appreciated' };
  return { tone: 'split', flashLabel: 'Opinion is split', entityLabel: 'Opinion is split' };
}

/**
 * The one-sentence reading of the gap between the verdict and the volume.
 *
 * Generated from the real figures rather than picked from a list, because the
 * interesting cases are the asymmetric ones: a small group reacting far harder
 * than a large one is exactly what the page exists to make visible, and saying
 * so in a sentence is quicker than asking anyone to compare four numbers.
 *
 * Every branch it can take is a true statement about the data, including the
 * empty and one-sided ones.
 */
export function intensityComparison(totals: ArtifactTotals): string {
  const critical = totals.negativeOpinionTotal;
  const appreciative = totals.positiveOpinionTotal;
  const people = critical + appreciative;
  const eggs = totals.rottenEggTotal;
  const medals = totals.medalTotal;

  if (people === 0) return 'Nobody has taken a side yet, so there is no verdict to report.';

  if (critical === 0) {
    return people === 1
      ? 'One person has weighed in, and they are appreciative.'
      : `All ${people} people who have weighed in are appreciative.`;
  }
  if (appreciative === 0) {
    return people === 1
      ? 'One person has weighed in, and they are critical.'
      : `All ${people} people who have weighed in are critical.`;
  }

  /*
   * Reactions per person on each side. This is the figure that separates a
   * widely held mild view from a narrowly held furious one, and it is the only
   * fair way to compare two groups of different sizes.
   */
  const perCritic = eggs / critical;
  const perAdmirer = medals / appreciative;
  const majority = critical > appreciative ? 'critical' : appreciative > critical ? 'appreciative' : 'even';

  const louder =
    perCritic >= perAdmirer * 1.5 ? 'critical' : perAdmirer >= perCritic * 1.5 ? 'appreciative' : null;

  if (majority === 'even') {
    if (!louder) return 'People are evenly split, and both sides are reacting with much the same intensity.';
    return louder === 'critical'
      ? 'People are evenly split, but the critical side is reacting far harder.'
      : 'People are evenly split, but the appreciative side is reacting far harder.';
  }

  const smaller = majority === 'critical' ? 'appreciative' : 'critical';

  if (louder === smaller) {
    return majority === 'critical'
      ? 'Most people are critical, while the smaller appreciative group reacted more intensely.'
      : 'Most people are appreciative, while the smaller critical group reacted more intensely.';
  }

  return majority === 'critical'
    ? 'Most people are critical, and they are also sending the most reactions.'
    : 'Most people are appreciative, and they are also sending the most reactions.';
}

/**
 * "Sent by 5 people" — the phrase that stops a tap total being read as a crowd.
 *
 * Every place a reaction total appears at size is required to carry one of
 * these, so "100 Rotten Eggs" can never stand alone looking like a hundred
 * angry people.
 */
export function contributorPhrase(reactionType: 'rotten_egg' | 'medal', contributors: number): string {
  if (contributors === 0) return 'Nobody yet';
  const verb = reactionType === 'rotten_egg' ? 'Sent' : 'Given';
  return `${verb} by ${contributors === 1 ? '1 person' : `${contributors.toLocaleString('en-US')} people`}`;
}

/** "5 appreciative · 1 critical", for the compact card footers. */
export function opinionPhrase(totals: ArtifactTotals): string {
  const critical = totals.negativeOpinionTotal;
  const appreciative = totals.positiveOpinionTotal;
  if (critical + appreciative === 0) return 'No opinions yet';
  return `${appreciative.toLocaleString('en-US')} appreciative · ${critical.toLocaleString('en-US')} critical`;
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

/** Grouped remote activity, reported plainly. */
export function crowdSignal(reactionType: 'rotten_egg' | 'medal', formattedQuantity: string): string {
  return reactionType === 'rotten_egg'
    ? `+${formattedQuantity} Rotten Eggs`
    : `+${formattedQuantity} Medals`;
}
