import type { ChildReadableChapter } from '@/lib/supabase/types';

import { ALLOWANCE_SIZE, computeAllowanceStatus, currentPeriodEnd, currentPeriodStart } from './allowance';

function chapter(number: number, createdAt: string): ChildReadableChapter {
  return {
    id: `ch-${number}`,
    child_id: 'child-1',
    number,
    title_en: `Chapter ${number}`,
    title_ko: `${number}장`,
    lesson: null,
    situation: null,
    pages: [],
    summary: '',
    reviewed_at: null,
    read_at: null,
    created_at: createdAt,
  };
}

const NOW = new Date('2026-08-15T12:00:00.000Z');

describe('currentPeriodStart / currentPeriodEnd', () => {
  it('is the first of the current UTC month through the first of the next', () => {
    expect(currentPeriodStart(NOW).toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(currentPeriodEnd(NOW).toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('computeAllowanceStatus', () => {
  it('is unused with nothing read yet', () => {
    const status = computeAllowanceStatus([], NOW);
    expect(status).toEqual({
      used: 0,
      limit: ALLOWANCE_SIZE,
      remaining: ALLOWANCE_SIZE,
      blocked: false,
      periodEnds: currentPeriodEnd(NOW),
    });
  });

  it('only counts chapters from the current calendar month', () => {
    const chapters = [
      chapter(1, '2026-07-20T00:00:00.000Z'), // last month — does not count
      chapter(2, '2026-08-01T00:00:00.000Z'),
      chapter(3, '2026-08-14T00:00:00.000Z'),
    ];
    const status = computeAllowanceStatus(chapters, NOW);
    expect(status.used).toBe(2);
    expect(status.remaining).toBe(ALLOWANCE_SIZE - 2);
    expect(status.blocked).toBe(false);
  });

  it('blocks once the allowance is fully used, kindly rather than over', () => {
    const chapters = Array.from({ length: ALLOWANCE_SIZE }, (_, i) =>
      chapter(i + 1, '2026-08-02T00:00:00.000Z'));
    const status = computeAllowanceStatus(chapters, NOW);
    expect(status.used).toBe(ALLOWANCE_SIZE);
    expect(status.remaining).toBe(0);
    expect(status.blocked).toBe(true);
  });

  it('ignores a chapter with an unparseable created_at rather than throwing', () => {
    const chapters = [chapter(1, '')];
    const status = computeAllowanceStatus(chapters, NOW);
    expect(status.used).toBe(0);
    expect(status.blocked).toBe(false);
  });

  it('resets at the top of a new month', () => {
    const augustChapters = Array.from({ length: ALLOWANCE_SIZE }, (_, i) =>
      chapter(i + 1, '2026-08-02T00:00:00.000Z'));
    const september = new Date('2026-09-01T00:00:00.001Z');
    const status = computeAllowanceStatus(augustChapters, september);
    expect(status.used).toBe(0);
    expect(status.blocked).toBe(false);
  });
});
