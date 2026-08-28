// jest.mock factories are hoisted above the file, so anything they close over
// has to be named `mock*` to be allowed through.
const mockInvoke = jest.fn();
const mockBodyOf = jest.fn();

jest.mock('./client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

// bodyOf's own job — reading the non-2xx body off a real fetch Response — is
// exercised by character.ts's existing use of the identical helper; mocking
// it here keeps this file about enqueueTomorrow's branching, not about
// Response support in whichever environment Jest happens to run under.
jest.mock('./function-error', () => ({
  bodyOf: (...args: unknown[]) => mockBodyOf(...args),
}));

import { enqueueTomorrow, GenerationQuotaError } from './nightly';

/**
 * The spend guard (issue #6) speaks through the response body, not the
 * generic FunctionsHttpError message — this is what turns that body into
 * something the UI can render bilingually instead of a bare 429.
 */
describe('enqueueTomorrow', () => {
  afterEach(() => jest.clearAllMocks());

  it('resolves normally when the call succeeds', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, lesson: 'sharing' }, error: null });

    await expect(enqueueTomorrow('child-1', 'sharing')).resolves.toEqual({
      ok: true,
      lesson: 'sharing',
    });
    expect(mockBodyOf).not.toHaveBeenCalled();
  });

  it('throws GenerationQuotaError with the bilingual copy from the response body', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('Edge Function returned a non-2xx status code'),
    });
    mockBodyOf.mockResolvedValue({
      ok: false,
      code: 'monthly_quota_reached',
      message_en: "This month's book is already full of chapters.",
      message_ko: '이번 달 책이 이야기로 가득 찼어요!',
      resets_at: '2026-09-01T00:00:00.000Z',
    });

    const attempt = enqueueTomorrow('child-1');
    await expect(attempt).rejects.toBeInstanceOf(GenerationQuotaError);
    await attempt.catch((e: InstanceType<typeof GenerationQuotaError>) => {
      expect(e.code).toBe('monthly_quota_reached');
      expect(e.messageEn).toMatch(/full of chapters/);
      expect(e.messageKo).toMatch(/이번 달/);
      expect(e.resetsAt).toBe('2026-09-01T00:00:00.000Z');
    });
  });

  it('throws GenerationQuotaError for a rate_limited response too', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('Edge Function returned a non-2xx status code'),
    });
    mockBodyOf.mockResolvedValue({
      ok: false,
      code: 'rate_limited',
      message_en: "Let's slow down just a little.",
      message_ko: '잠깐 쉬어갈까요?',
    });

    await expect(enqueueTomorrow('child-1')).rejects.toMatchObject({ code: 'rate_limited' });
  });

  it('rethrows the raw error for a failure that is not a quota block', async () => {
    const original = new Error('child not found');
    mockInvoke.mockResolvedValue({ data: null, error: original });
    mockBodyOf.mockResolvedValue({ ok: false, error: 'child not found' });

    await expect(enqueueTomorrow('child-1')).rejects.toBe(original);
  });

  it('rethrows the raw error when the body cannot be parsed at all', async () => {
    const original = new Error('network blip');
    mockInvoke.mockResolvedValue({ data: null, error: original });
    mockBodyOf.mockResolvedValue(null);

    await expect(enqueueTomorrow('child-1')).rejects.toBe(original);
  });
});
