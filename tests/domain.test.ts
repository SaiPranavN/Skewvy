import { describe, it, expect } from 'vitest';
import { formatCount, formatCompact, sharePercent } from '@/lib/domain/format';
import { sentimentLabel, pickFrom, HEAT_LINES } from '@/lib/domain/copy';
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
  const totals = (eggs: number, medals: number) => ({ ...emptyTotals('flash_news', 'x'), rottenEggTotal: eggs, medalTotal: medals });

  it('calls out a heavily negative artifact', () => {
    expect(sentimentLabel(totals(9000, 500)).label).toBe('Publicly cooked');
    expect(sentimentLabel(totals(9000, 500)).tone).toBe('egg');
  });

  it('recognises appreciation', () => {
    expect(sentimentLabel(totals(400, 9000)).label).toBe('Getting its flowers');
    expect(sentimentLabel(totals(400, 9000)).tone).toBe('medal');
  });

  it('recognises a genuine split', () => {
    expect(sentimentLabel(totals(5000, 5000)).label).toBe('Crowd split');
  });

  it('does not judge an artifact with barely any reactions', () => {
    expect(sentimentLabel(totals(10, 2)).label).toBe('Freshly on trial');
  });

  it('never labels a private individual — the tones map to states, not people', () => {
    const tones = [totals(9000, 500), totals(400, 9000), totals(5000, 5000)].map((value) => sentimentLabel(value).tone);
    expect(tones).toEqual(['egg', 'medal', 'split']);
  });
});

describe('reaction and stance mapping', () => {
  it('maps Rotten Eggs to a negative opinion and Medals to a positive one', () => {
    expect(stanceForReaction('rotten_egg')).toBe('negative');
    expect(stanceForReaction('medal')).toBe('positive');
  });
});

describe('deterministic copy selection', () => {
  it('returns the same line for the same seed, so server and client agree', () => {
    const first = pickFrom(HEAT_LINES, 'nimbus-fare');
    const second = pickFrom(HEAT_LINES, 'nimbus-fare');
    expect(first).toBe(second);
    expect(HEAT_LINES).toContain(first);
  });

  it('varies across seeds', () => {
    const lines = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((seed) => pickFrom(HEAT_LINES, seed)),
    );
    expect(lines.size).toBeGreaterThan(1);
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
