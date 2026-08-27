import {
  friendlyProviderMessage,
  isTransientProviderError,
  withRetry,
} from '../../../supabase/functions/_shared/retry';

/**
 * Retrying is easy to get subtly wrong in the expensive direction: retrying a
 * request the provider will refuse just as firmly next time costs money and
 * makes the parent wait longer to see the same failure. So the interesting
 * assertions here are about what is NOT retried.
 */
describe('isTransientProviderError', () => {
  it('recognises the failures worth another go', () => {
    // The exact strings this project has actually seen from Gemini.
    for (const message of [
      'sheet generation failed (503): {"error":{"code":503,"message":"This model is currently experiencing high demand."}}',
      'sheet generation failed (500): {"error":{"code":500,"message":"Internal error encountered.","status":"INTERNAL"}}',
      'page 3 failed (429): rate limit',
      'UNAVAILABLE',
      'socket timeout',
    ]) {
      expect(isTransientProviderError(new Error(message))).toBe(true);
    }
  });

  it('does not retry what will fail identically next time', () => {
    for (const message of [
      'sheet generation failed (400): invalid argument',
      'no image returned (finish=IMAGE_SAFETY)',
      'GEMINI_API_KEY not set',
      'sheet generation failed (401): unauthorized',
      'sheet generation failed (403): permission denied',
    ]) {
      expect(isTransientProviderError(new Error(message))).toBe(false);
    }
  });
});

describe('withRetry', () => {
  it('returns the first success without retrying', async () => {
    const work = jest.fn().mockResolvedValue('sheet');
    await expect(withRetry(work, { baseDelayMs: 1 })).resolves.toBe('sheet');
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('gives a transient failure three attempts in total', async () => {
    const work = jest.fn()
      .mockRejectedValueOnce(new Error('failed (503): high demand'))
      .mockRejectedValueOnce(new Error('failed (503): high demand'))
      .mockResolvedValue('sheet');

    await expect(withRetry(work, { baseDelayMs: 1 })).resolves.toBe('sheet');
    // Three attempts, matching chapter generation — not three retries.
    expect(work).toHaveBeenCalledTimes(3);
  });

  it('stops at three and rethrows what the provider actually said', async () => {
    const work = jest.fn().mockRejectedValue(new Error('failed (503): high demand'));

    // The last error, not a wrapper: the point is to try again, not to hide why.
    await expect(withRetry(work, { baseDelayMs: 1 }))
      .rejects
      .toThrow('failed (503): high demand');
    expect(work).toHaveBeenCalledTimes(3);
  });

  it('gives up immediately on a permanent failure', async () => {
    const work = jest.fn().mockRejectedValue(new Error('failed (400): invalid argument'));

    await expect(withRetry(work, { baseDelayMs: 1 })).rejects.toThrow('400');
    // The money assertion: a 400 must cost one call, not three.
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('backs off rather than hammering a struggling provider', async () => {
    const delays: number[] = [];
    let previous = Date.now();
    const work = jest.fn().mockImplementation(() => {
      delays.push(Date.now() - previous);
      previous = Date.now();
      return Promise.reject(new Error('failed (503): high demand'));
    });

    await expect(withRetry(work, { baseDelayMs: 20 })).rejects.toThrow();
    // First call is immediate; the two retries wait, and the second waits longer.
    expect(delays[1]).toBeGreaterThanOrEqual(15);
    expect(delays[2]).toBeGreaterThan(delays[1]);
  });
});

describe('friendlyProviderMessage', () => {
  it('tells a parent what happened and that nothing was lost', () => {
    const message = friendlyProviderMessage(new Error('failed (503): high demand'));

    expect(message).toMatch(/busy/i);
    expect(message).toMatch(/nothing was saved/i);
    expect(message).toMatch(/try again/i);
    // A parent cannot act on a status code, and it reads like their fault.
    expect(message).not.toMatch(/503|UNAVAILABLE|\{/);
  });

  it('still says something useful for an unexpected failure', () => {
    const message = friendlyProviderMessage(new Error('failed (400): invalid argument'));

    expect(message).toMatch(/nothing was saved/i);
    expect(message).not.toMatch(/400/);
  });
});
