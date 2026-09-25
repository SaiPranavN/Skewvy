import { describe, it, expect } from 'vitest';
import { formatCount, formatCompact, sharePercent } from '@/lib/domain/format';
import { sentimentLabel, cardTone, intensityComparison, contributorPhrase } from '@/lib/domain/copy';
import { stanceForReaction, emptyTotals } from '@/lib/domain/types';
import { toSqlitePlaceholders } from '@/lib/db/sqlite';
import { bucketStart, nextBucket, previousBucket, defaultRange } from '@/lib/domain/trend-ranges';
import { receiptVariant } from '@/lib/client/receipt';
import { detailsFromObject, cardDetailLine, parseDetails, serializeDetails } from '@/lib/domain/details';
import { initialsFor, placeholderColour } from '@/components/ui/Media';

describe('number presentation', () => {
  it('shows reaction totals in full, never abbreviated', () => {
    expect(formatCount(128429)).toBe('128,429');
    expect(formatCount(94218)).toBe('94,218');
  });

  it('keeps compact form for secondary spots only, and only above 10k', () => {
    expect(formatCompact(9999)).toBe('9,999');
    expect(formatCompact(128429)).toBe('128.4K');
  });

  it('reports opinion share as whole numbers, with no false precision', () => {
    expect(sharePercent(8392, 8392 + 6817)).toBe(55);
    expect(Number.isInteger(sharePercent(1, 3))).toBe(true);
    // An artifact nobody has weighed in on reads as an even split, not NaN.
    expect(sharePercent(0, 0)).toBe(50);
  });
});

describe('sentiment labels', () => {
  const totals = (eggs: number, medals: number) => ({
    ...emptyTotals('flash_news', 'x'),
    rottenEggTotal: eggs,
    medalTotal: medals,
  });

  it('reports strong disapproval factually', () => {
    expect(sentimentLabel(totals(9000, 500)).label).toBe('Strong disapproval');
    expect(sentimentLabel(totals(9000, 500)).tone).toBe('egg');
  });

  it('reports strong approval factually', () => {
    expect(sentimentLabel(totals(400, 9000)).label).toBe('Strong approval');
    expect(sentimentLabel(totals(400, 9000)).tone).toBe('medal');
  });

  it('reports a genuine split', () => {
    expect(sentimentLabel(totals(5000, 5000)).label).toBe('Public opinion divided');
  });

  it('does not characterise an artifact with barely any reactions', () => {
    expect(sentimentLabel(totals(10, 2)).label).toBe('Early reaction');
  });

  it('labels the measurement, never a person', () => {
    const labels = [totals(9000, 500), totals(400, 9000), totals(5000, 5000), totals(10, 2)].map(
      (value) => sentimentLabel(value).label,
    );
    // No verdict language, no slang, nothing aimed at an individual.
    for (const label of labels) {
      expect(label).not.toMatch(/cooked|flowers|\bL\b|\bW\b|roast|heat/i);
    }
  });
});

describe('reaction and stance mapping', () => {
  it('maps Rotten Eggs to a negative opinion and Medals to a positive one', () => {
    expect(stanceForReaction('rotten_egg')).toBe('negative');
    expect(stanceForReaction('medal')).toBe('positive');
  });
});

describe('SQL placeholder translation', () => {
  it('rewrites $n placeholders in the order they appear', () => {
    const result = toSqlitePlaceholders('SELECT * FROM t WHERE a = $1 AND b = $2', ['x', 'y']);
    expect(result.sql).toBe('SELECT * FROM t WHERE a = ? AND b = ?');
    expect(result.params).toEqual(['x', 'y']);
  });

  it('duplicates a parameter reused in the statement', () => {
    const result = toSqlitePlaceholders('INSERT INTO t (a, b) VALUES ($1, $1)', ['same']);
    expect(result.sql).toBe('INSERT INTO t (a, b) VALUES (?, ?)');
    expect(result.params).toEqual(['same', 'same']);
  });

  it('handles out-of-order placeholders', () => {
    const result = toSqlitePlaceholders('SELECT $2, $1', ['first', 'second']);
    expect(result.params).toEqual(['second', 'first']);
  });
});

/**
 * The rule the interface must never break: a verdict comes from people, and
 * people only. The pathological case — one furious person outspending a quiet
 * majority — is the reason the rule exists, so it gets its own test.
 */
describe('verdict labels', () => {
  const crowd = (eggs: number, medals: number, critical: number, appreciative: number) => ({
    ...emptyTotals('entity', 'x'),
    rottenEggTotal: eggs,
    medalTotal: medals,
    negativeOpinionTotal: critical,
    positiveOpinionTotal: appreciative,
    rottenEggContributorTotal: critical,
    medalContributorTotal: appreciative,
    uniqueParticipantTotal: critical + appreciative,
  });

  it('reads the verdict from people, not from reaction totals', () => {
    // 100 Rotten Eggs from one person against 50 Medals from five.
    const totals = crowd(100, 50, 1, 5);
    expect(cardTone(totals).tone).toBe('medal');
    expect(cardTone(totals).entityLabel).toBe('Mostly appreciated');
  });

  it('reads the other way when the people actually are critical', () => {
    expect(cardTone(crowd(50, 100, 5, 1)).tone).toBe('egg');
    expect(cardTone(crowd(50, 100, 5, 1)).flashLabel).toBe('Mostly criticized');
  });

  it('calls a genuine split a split', () => {
    expect(cardTone(crowd(900, 20, 5, 5)).tone).toBe('split');
    expect(cardTone(crowd(900, 20, 5, 5)).entityLabel).toBe('Opinion is split');
  });

  it('says nothing at all about an item nobody has weighed in on', () => {
    // Reactions cannot exist without an opinion, but the guard must hold
    // regardless of what the totals row happens to contain.
    expect(cardTone(crowd(0, 0, 0, 0)).entityLabel).toBe('No record yet');
    expect(cardTone(crowd(0, 0, 0, 0)).tone).toBe('split');
  });
});

describe('the comparison sentence', () => {
  const crowd = (eggs: number, medals: number, critical: number, appreciative: number) => ({
    ...emptyTotals('entity', 'x'),
    rottenEggTotal: eggs,
    medalTotal: medals,
    negativeOpinionTotal: critical,
    positiveOpinionTotal: appreciative,
    rottenEggContributorTotal: critical,
    medalContributorTotal: appreciative,
  });

  it('names the loud minority when the majority is quieter', () => {
    expect(intensityComparison(crowd(100, 50, 1, 5))).toBe(
      'Most people are appreciative, while the smaller critical group reacted more intensely.',
    );
  });

  it('says so plainly when the majority is also the loudest', () => {
    expect(intensityComparison(crowd(500, 10, 5, 1))).toBe(
      'Most people are critical, and they are also sending the most reactions.',
    );
  });

  it('handles an even split', () => {
    expect(intensityComparison(crowd(50, 50, 5, 5))).toMatch(/evenly split/);
    expect(intensityComparison(crowd(400, 20, 5, 5))).toMatch(/critical side is reacting far harder/);
  });

  it('handles one-sided and empty states without inventing a comparison', () => {
    expect(intensityComparison(crowd(0, 90, 0, 9))).toBe('All 9 people who have weighed in are appreciative.');
    expect(intensityComparison(crowd(40, 0, 1, 0))).toBe('One person has weighed in, and they are critical.');
    expect(intensityComparison(crowd(0, 0, 0, 0))).toBe(
      'Nobody has taken a side yet, so there is no verdict to report.',
    );
  });
});

describe('reaction totals never stand alone', () => {
  it('states the head count behind a total, in people', () => {
    expect(contributorPhrase('rotten_egg', 1)).toBe('Sent by 1 person');
    expect(contributorPhrase('medal', 5)).toBe('Given by 5 people');
    expect(contributorPhrase('medal', 0)).toBe('Nobody yet');
  });

  it('never implies the tap total is a number of people', () => {
    // 392 Medals from 5 people must never render as "392 people".
    expect(contributorPhrase('medal', 5)).not.toContain('392');
  });
});

describe('trend range buckets', () => {
  it('starts weeks on Monday and months on the first, in UTC', () => {
    // Wednesday 24 September 2026, mid-afternoon.
    const wednesday = Date.UTC(2026, 8, 24, 15, 30);
    expect(new Date(bucketStart(wednesday, 'week')).toISOString()).toBe('2026-09-21T00:00:00.000Z');
    expect(new Date(bucketStart(wednesday, 'month')).toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(new Date(bucketStart(wednesday, 'hour')).toISOString()).toBe('2026-09-24T15:00:00.000Z');
  });

  it('steps months by the calendar, not by thirty days', () => {
    const january = Date.UTC(2026, 0, 1);
    expect(new Date(nextBucket(january, 'month')).toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(new Date(previousBucket(january, 'month')).toISOString()).toBe('2025-12-01T00:00:00.000Z');
  });

  it('opens on the range that fits the history', () => {
    const now = Date.UTC(2026, 8, 24);
    expect(defaultRange(null, now)).toBe('1m');
    expect(defaultRange(now - 3_600_000, now)).toBe('24h');
    expect(defaultRange(now - 5 * 86_400_000, now)).toBe('1w');
    expect(defaultRange(now - 400 * 86_400_000, now)).toBe('5y');
  });
});

describe('the share receipt', () => {
  it('leads with the side a person holds now, not their larger count', () => {
    // Gave 300 Medals to an entity, then turned critical and sent 4 Eggs.
    expect(receiptVariant({ medalCount: 300, rottenEggCount: 4, stance: 'negative' })).toBe('egg');
    expect(receiptVariant({ medalCount: 2, rottenEggCount: 90, stance: 'positive' })).toBe('medal');
    expect(receiptVariant({ medalCount: 0, rottenEggCount: 0, stance: null })).toBe('public');
  });
});

describe('details', () => {
  it('turns an imported metadata object into labelled rows', () => {
    const details = detailsFromObject({
      profession: 'Cricketer',
      official_url: 'https://www.bcci.tv/',
      platforms: ['PC', 'PlayStation 5'],
      founded: 2020,
      empty: '',
    });
    expect(details).toEqual([
      { label: 'Profession', value: 'Cricketer' },
      { label: 'Website', value: 'https://www.bcci.tv/' },
      { label: 'Platforms', value: 'PC, PlayStation 5' },
      { label: 'Founded', value: '2020' },
    ]);
  });

  it('puts plain facts on the card and keeps links and bookkeeping for the page', () => {
    const details = detailsFromObject({
      reference_url: 'https://example.test',
      verified_as_of: '2026-09-25',
      profession: 'Cricketer',
      country: 'India',
      known_for: 'Opening batter',
    });
    expect(cardDetailLine(details)).toBe('Cricketer · India');
    expect(cardDetailLine([])).toBeNull();
  });

  it('survives malformed stored JSON', () => {
    expect(parseDetails('not json')).toEqual([]);
    expect(parseDetails('[{"label":"A","value":"B"},{"label":7}]')).toEqual([{ label: 'A', value: 'B' }]);
    expect(serializeDetails([{ label: ' ', value: 'x' }])).toBeNull();
  });
});

describe('placeholder initials', () => {
  it('skips filler words and keeps short acronyms whole', () => {
    expect(initialsFor('Smriti Mandhana')).toBe('SM');
    expect(initialsFor('Food Safety and Standards Authority of India')).toBe('FS');
    expect(initialsFor('Reserve Bank of India')).toBe('RB');
    expect(initialsFor('The Earthshot Prize')).toBe('EP');
    expect(initialsFor('MTV')).toBe('MTV');
    expect(initialsFor('Disney+')).toBe('DI');
    expect(initialsFor("India Women's National Cricket Team")).toBe('IW');
  });

  it('gives the same name the same colour every time', () => {
    expect(placeholderColour('Google')).toBe(placeholderColour('Google'));
  });
});
