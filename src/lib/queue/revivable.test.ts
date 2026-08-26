import { isRevivable } from '../../../supabase/functions/_shared/revivable';

/**
 * The sweep's decision, tested on its own.
 *
 * A live smoke run left a stranded job sitting at `running` for ten minutes,
 * and there are only two explanations: the sweep never picked it up, or it did
 * and the revived worker died. Those need very different fixes, and one of them
 * can be ruled out here for free.
 *
 * The timestamp cases are the point. `staleBefore` is a JavaScript
 * `toISOString()` ending in `Z`; `started_at` comes back from PostgREST ending
 * in `+00:00`, often with six fractional digits. The original code compared
 * them as strings.
 */

const PG = (iso: string) => iso.replace('Z', '+00:00').replace(/\.(\d{3})/, '.$1456');

describe('isRevivable', () => {
  const now = Date.parse('2026-08-25T19:20:00.000Z');
  const staleBefore = new Date(now - 10 * 60_000).toISOString(); // 19:10:00.000Z

  it('always takes a queued job', () => {
    expect(isRevivable({ status: 'queued', started_at: null }, staleBefore)).toBe(true);
  });

  it('takes a running job whose worker went quiet long ago', () => {
    // The exact case the live smoke set up: stranded 30 minutes back.
    const started = PG(new Date(now - 30 * 60_000).toISOString());
    expect(isRevivable({ status: 'running', started_at: started }, staleBefore))
      .toBe(true);
  });

  it('leaves a job that is genuinely still being written', () => {
    const started = PG(new Date(now - 60_000).toISOString());
    expect(isRevivable({ status: 'running', started_at: started }, staleBefore))
      .toBe(false);
  });

  it('compares instants, not strings, across the hour boundary', () => {
    // 19:05 is stale against a 19:10 threshold. As strings both start "19:0"
    // vs "19:1" and happen to compare correctly — but the offset suffixes do
    // not, which is what makes the string version unsafe rather than wrong.
    const started = PG(new Date(now - 15 * 60_000).toISOString());
    expect(isRevivable({ status: 'running', started_at: started }, staleBefore))
      .toBe(true);
  });

  it('is not fooled by the +00:00 / Z suffix mismatch', () => {
    // Same instant on both sides: must NOT be considered stale.
    const sameInstant = PG(staleBefore);
    expect(isRevivable({ status: 'running', started_at: sameInstant }, staleBefore))
      .toBe(false);
  });

  it('ignores jobs that are already finished', () => {
    for (const status of ['done', 'failed']) {
      expect(isRevivable({ status, started_at: '2020-01-01T00:00:00+00:00' }, staleBefore))
        .toBe(false);
    }
  });

  it('does not revive a running job with no start time recorded', () => {
    expect(isRevivable({ status: 'running', started_at: null }, staleBefore))
      .toBe(false);
  });
});
