import { describe, it, expect } from 'vitest';
import { formatCount, formatCompact, sharePercent } from '@/lib/domain/format';
import { sentimentLabel } from '@/lib/domain/copy';
import { stanceForReaction, emptyTotals } from '@/lib/domain/types';
import { toSqlitePlaceholders } from '@/lib/db/sqlite';

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
