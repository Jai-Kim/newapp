import { CrisisDetectedError, enqueueTomorrow, GenerationQuotaError } from './nightly';

/**
 * The client-side half of the server-side spend guard (issue #6): a blocked
 * `enqueue-chapter` call has to turn into a typed, bilingual error rather
 * than the generic FunctionsHttpError supabase-js produces for any non-2xx
 * response.
 */

const mockInvoke = jest.fn();

jest.mock('./client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

afterEach(() => {
  jest.clearAllMocks();
});

describe('enqueueTomorrow', () => {
  describe('quota and generic errors', () => {
    it('returns the job info on success', async () => {
      mockInvoke.mockResolvedValue({
        data: { ok: true, job_id: 'job-1', lesson: 'sharing', auto_chosen: false },
        error: null,
      });

      const result = await enqueueTomorrow('child-1', 'sharing');

      expect(result).toEqual({
        ok: true,
        job_id: 'job-1',
        lesson: 'sharing',
        auto_chosen: false,
      });
    });

    it('translates a quota-blocked response into a bilingual GenerationQuotaError', async () => {
      const body = {
        ok: false,
        code: 'monthly_quota_exceeded',
        message_en: 'This month\'s book is finished! A new one starts next month.',
        message_ko: '이번 달 책이 완성되었어요! 다음 달에 새 책이 시작돼요.',
      };
      mockInvoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: new Response(JSON.stringify(body), { status: 429 }),
        },
      });

      let caught: unknown;
      try {
        await enqueueTomorrow('child-1');
      }
      catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(GenerationQuotaError);
      const err = caught as GenerationQuotaError;
      expect(err.code).toBe('monthly_quota_exceeded');
      expect(err.messageEn).toBe(body.message_en);
      expect(err.messageKo).toBe(body.message_ko);
    });

    it('translates a rate-limited response the same way', async () => {
      const body = {
        ok: false,
        code: 'rate_limited',
        message_en: 'Let\'s slow down for just a moment — try again in a minute.',
        message_ko: '잠시 쉬어가요 — 1분 후에 다시 시도해 주세요.',
      };
      mockInvoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: new Response(JSON.stringify(body), { status: 429 }),
        },
      });

      await expect(enqueueTomorrow('child-1')).rejects.toBeInstanceOf(GenerationQuotaError);
    });

    it('rethrows a plain error untranslated when the failure is not quota-shaped', async () => {
      const plain = new Error('network down');
      mockInvoke.mockResolvedValue({ data: null, error: plain });

      await expect(enqueueTomorrow('child-1')).rejects.toBe(plain);
    });
  });

  describe('crisis detection', () => {
    it('translates a crisis-blocked response into a bilingual CrisisDetectedError with resources', async () => {
      const body = {
        ok: false,
        code: 'crisis_detected',
        category: 'self_harm',
        message_en: 'Thank you for telling us.',
        message_ko: '말씀해 주셔서 감사해요.',
        disclaimer_en: 'Storyloom is not a crisis service.',
        disclaimer_ko: 'Storyloom은 위기 상담 서비스가 아니에요.',
        resources: [
          {
            region: 'kr',
            name_en: 'Suicide Prevention Counseling Center (Korea)',
            name_ko: '자살예방상담전화',
            contact: '109',
            note_en: 'Free, 24/7.',
            note_ko: '24시간 무료.',
          },
        ],
      };
      mockInvoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: new Response(JSON.stringify(body), { status: 422 }),
        },
      });

      let caught: unknown;
      try {
        await enqueueTomorrow('child-1', undefined, 'situation the parent typed');
      }
      catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(CrisisDetectedError);
      const err = caught as CrisisDetectedError;
      expect(err.category).toBe('self_harm');
      expect(err.messageEn).toBe(body.message_en);
      expect(err.messageKo).toBe(body.message_ko);
      expect(err.resources).toEqual([
        {
          region: 'kr',
          nameEn: 'Suicide Prevention Counseling Center (Korea)',
          nameKo: '자살예방상담전화',
          contact: '109',
          noteEn: 'Free, 24/7.',
          noteKo: '24시간 무료.',
        },
      ]);
    });
  });
});
