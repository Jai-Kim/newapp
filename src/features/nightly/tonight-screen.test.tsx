import * as React from 'react';

import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';
import { TonightScreen } from './tonight-screen';

/**
 * The five states of the home screen at bedtime.
 *
 * Worth testing rather than eyeballing: four of the five are states a parent
 * only reaches when something has gone slowly or gone wrong, so they are the
 * ones least likely to be looked at during development and most likely to be
 * seen at 8pm by someone tired.
 */

// jest.mock factories are hoisted above the file, so anything they close over
// has to be named `mock*` to be allowed through.
const mockEnqueueTomorrow = jest.fn(async () => ({ ok: true }));
const mockGetNightlyState = jest.fn();
const mockPush = jest.fn();
// No initial implementation (kept untyped, like `mockGetNightlyState` above)
// so `.mockResolvedValueOnce` can hand back either language's literal shape
// without fighting TS's inference. Defaults to a Korean-led child in
// `beforeEach`, matching every pre-existing test in this file; bilingual-
// chrome tests override it per-test to check the English lead too.
const mockListChildren = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  // The screen refetches on focus; in a test it is mounted once, so running
  // the callback on mount is the same thing.
  useFocusEffect: (cb: () => void) => {
    require('react').useEffect(cb, [cb]);
  },
}));

jest.mock('@/lib/supabase/chapters', () => ({
  listChildren: () => mockListChildren(),
}));

jest.mock('@/lib/supabase/nightly', () => {
  // Defined entirely inside the factory (no outer closure) so it survives
  // babel-plugin-jest-hoist's out-of-scope check. use-nightly.ts checks a
  // caught error with `instanceof GenerationQuotaError`/`CrisisDetectedError`,
  // so the mock has to export real classes, not a plain object shape.
  class GenerationQuotaError extends Error {
    code: string;
    messageEn: string;
    messageKo: string;

    constructor(options: { code: string; messageEn: string; messageKo: string }) {
      super(options.messageEn);
      this.code = options.code;
      this.messageEn = options.messageEn;
      this.messageKo = options.messageKo;
    }
  }

  class CrisisDetectedError extends Error {
    category: string | null;
    messageEn: string;
    messageKo: string;
    disclaimerEn: string;
    disclaimerKo: string;
    resources: {
      region: string;
      nameEn: string;
      nameKo: string;
      contact: string;
      noteEn: string;
      noteKo: string;
    }[];

    constructor(options: {
      category: string | null;
      messageEn: string;
      messageKo: string;
      disclaimerEn: string;
      disclaimerKo: string;
      resources: CrisisDetectedError['resources'];
    }) {
      super(options.messageEn);
      this.category = options.category;
      this.messageEn = options.messageEn;
      this.messageKo = options.messageKo;
      this.disclaimerEn = options.disclaimerEn;
      this.disclaimerKo = options.disclaimerKo;
      this.resources = options.resources;
    }
  }

  return {
    getNightlyState: () => mockGetNightlyState(),
    enqueueTomorrow: (...args: unknown[]) => mockEnqueueTomorrow(...(args as [])),
    sweepQueue: async () => 0,
    GenerationQuotaError,
    CrisisDetectedError,
  };
});

beforeEach(() => {
  mockListChildren.mockResolvedValue([
    { id: 'child-1', first_name: 'Yuna', primary_language: 'ko' },
  ]);
});

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

const job = {
  id: 'job-1',
  child_id: 'child-1',
  lesson: 'being brave about something new',
  situation: null,
  auto_chosen: false,
  status: 'running' as const,
  attempts: 1,
  error: null,
  chapter_id: null,
  requested_by: null,
  created_at: '',
  started_at: null,
  finished_at: null,
};

describe('tonightScreen', () => {
  describe('the five states', () => {
    it('leads with the chapter when one is ready', async () => {
      mockGetNightlyState.mockResolvedValue({
        kind: 'ready',
        chapter: {
          id: 'ch-1',
          number: 4,
          title_en: 'The Quiet Bridge',
          title_ko: '조용한 다리',
          pages: [],
        },
      });
      setup(<TonightScreen />);

      expect(await screen.findByText(/Tonight's chapter is ready/i)).toBeOnTheScreen();
      // Both languages on the card, per ADR-0001 §1.
      expect(screen.getByText(/The Quiet Bridge/)).toBeOnTheScreen();
      expect(screen.getByText('조용한 다리')).toBeOnTheScreen();
      expect(screen.getByTestId('read-tonight')).toBeOnTheScreen();
    });

    it('sends the parent to review when the gate has not been passed', async () => {
      mockGetNightlyState.mockResolvedValue({
        kind: 'awaiting_review',
        chapterId: 'ch-2',
        title: 'The Quiet Bridge',
      });
      const { user } = setup(<TonightScreen />);

      await user.press(await screen.findByTestId('go-review'));
      expect(mockPush).toHaveBeenCalledWith('/review/ch-2');
    });

    it('says what is being written and that nobody has to wait', async () => {
      mockGetNightlyState.mockResolvedValue({ kind: 'writing', job });
      setup(<TonightScreen />);

      expect(await screen.findByText(/Writing tomorrow's chapter/i)).toBeOnTheScreen();
      expect(screen.getByText(/being brave about something new/)).toBeOnTheScreen();
      expect(screen.getByText(/don't have to wait/i)).toBeOnTheScreen();
    });

    it('offers a retry when generation gave up', async () => {
      mockGetNightlyState.mockResolvedValue({
        kind: 'failed',
        job: { ...job, status: 'failed', error: 'provider unavailable' },
      });
      const { user } = setup(<TonightScreen />);

      await user.press(await screen.findByTestId('retry-job'));
      // Retries the lesson they chose, rather than silently picking a new one.
      await waitFor(() =>
        expect(mockEnqueueTomorrow).toHaveBeenCalledWith(
          'child-1',
          'being brave about something new',
          undefined,
        ));
    });

    it('asks what tomorrow is about when nothing is queued', async () => {
      mockGetNightlyState.mockResolvedValue({ kind: 'empty' });
      const { user } = setup(<TonightScreen />);

      expect(
        await screen.findByText(/What should tomorrow be about\?/i),
      ).toBeOnTheScreen();
      // The sensitive-topic disclaimer (issue #13) is always visible next to
      // the situation field, not only after a request is blocked.
      expect(screen.getByTestId('sensitive-topic-disclaimer')).toBeOnTheScreen();

      // "You choose for me" must still queue something — a family that skips
      // the prompt should wake up to a chapter, not to nothing.
      await user.press(screen.getByTestId('queue-auto'));
      await waitFor(() =>
        expect(mockEnqueueTomorrow).toHaveBeenCalledWith('child-1', undefined, undefined));
    });
  });

  describe('blocked-request notices', () => {
    it('shows a warm bilingual notice, not the generic red error, when the monthly allowance is used up', async () => {
      const { GenerationQuotaError } = jest.requireMock('@/lib/supabase/nightly');
      mockGetNightlyState.mockResolvedValue({ kind: 'empty' });
      mockEnqueueTomorrow.mockRejectedValueOnce(new GenerationQuotaError({
        code: 'monthly_quota_exceeded',
        messageEn: 'This month\'s book is finished! A new one starts next month.',
        messageKo: '이번 달 책이 완성되었어요! 다음 달에 새 책이 시작돼요.',
      }));
      const { user } = setup(<TonightScreen />);

      expect(await screen.findByText(/What should tomorrow be about\?/i)).toBeOnTheScreen();
      await user.press(screen.getByTestId('queue-auto'));

      expect(await screen.findByTestId('quota-notice')).toBeOnTheScreen();
      // Bilingual, per ADR-0001 §1 — both languages render regardless of lead.
      expect(screen.getByText(/This month's book is finished!/)).toBeOnTheScreen();
      expect(screen.getByText('이번 달 책이 완성되었어요! 다음 달에 새 책이 시작돼요.')).toBeOnTheScreen();
      // The notice replaces the picker, and is not the generic red error box.
      expect(screen.queryByText(/What should tomorrow be about\?/i)).not.toBeOnTheScreen();
    });

    it('shows a warm bilingual care notice with real resources when the input is crisis-screened', async () => {
      const { CrisisDetectedError } = jest.requireMock('@/lib/supabase/nightly');
      mockGetNightlyState.mockResolvedValue({ kind: 'empty' });
      mockEnqueueTomorrow.mockRejectedValueOnce(new CrisisDetectedError({
        category: 'self_harm',
        messageEn: 'Thank you for telling us.',
        messageKo: '말씀해 주셔서 감사해요.',
        disclaimerEn: 'Storyloom is not a crisis service.',
        disclaimerKo: 'Storyloom은 위기 상담 서비스가 아니에요.',
        resources: [
          {
            region: 'kr',
            nameEn: 'Suicide Prevention Counseling Center (Korea)',
            nameKo: '자살예방상담전화',
            contact: '109',
            noteEn: 'Free, 24/7.',
            noteKo: '24시간 무료.',
          },
        ],
      }));
      const { user } = setup(<TonightScreen />);

      expect(await screen.findByText(/What should tomorrow be about\?/i)).toBeOnTheScreen();
      await user.press(screen.getByTestId('queue-auto'));

      expect(await screen.findByTestId('crisis-notice')).toBeOnTheScreen();
      // Bilingual, per ADR-0001 §1 — both languages render regardless of lead.
      expect(screen.getByText('Thank you for telling us.')).toBeOnTheScreen();
      expect(screen.getByText('말씀해 주셔서 감사해요.')).toBeOnTheScreen();
      // A real resource, not a placeholder.
      expect(screen.getByText(/109/)).toBeOnTheScreen();
      // The notice replaces the picker, and is not the generic red error box.
      expect(screen.queryByText(/What should tomorrow be about\?/i)).not.toBeOnTheScreen();
    });
  });
});

/**
 * Bilingual chrome (issue #22, follow-up to #41/#42/#43/#44/#45). This file
 * already threaded `lead` into `LessonPicker`/`CrisisNotice`/`QuotaNotice`
 * three separate times — everything the switch renders *around* them was
 * still English-only. `mockListChildren` defaults to a Korean-led child
 * (matching every test in `describe('tonightScreen', ...)` above); these
 * tests override it to check the English lead too.
 *
 * A top-level sibling describe, not nested inside `tonightScreen` above —
 * `max-lines-per-function` (110) counts nested describes toward their
 * parent, and #43 established flat top-level describes as how this repo
 * avoids that trap in test files.
 */
describe('tonightScreen — bilingual chrome', () => {
  it('shows the ready card in both languages, English-led', async () => {
    mockListChildren.mockResolvedValueOnce([
      { id: 'child-1', first_name: 'Yuna', primary_language: 'en' },
    ]);
    mockGetNightlyState.mockResolvedValue({
      kind: 'ready',
      chapter: {
        id: 'ch-1',
        number: 4,
        title_en: 'The Quiet Bridge',
        title_ko: '조용한 다리',
        pages: [],
      },
    });
    setup(<TonightScreen />);

    expect(await screen.findByText('Tonight')).toBeOnTheScreen();
    expect(screen.getByText('오늘 밤')).toBeOnTheScreen();
    expect(screen.getByText('All chapters')).toBeOnTheScreen();
    expect(screen.getByText('전체 챕터')).toBeOnTheScreen();
    expect(screen.getByText('Tonight\'s chapter is ready')).toBeOnTheScreen();
    expect(screen.getByText('오늘 밤 챕터가 준비됐어요')).toBeOnTheScreen();
    expect(screen.getByText('Read together · 함께 읽기')).toBeOnTheScreen();
  });

  it('shows the ready card in both languages, Korean-led', async () => {
    mockGetNightlyState.mockResolvedValue({
      kind: 'ready',
      chapter: {
        id: 'ch-1',
        number: 4,
        title_en: 'The Quiet Bridge',
        title_ko: '조용한 다리',
        pages: [],
      },
    });
    setup(<TonightScreen />);

    expect(await screen.findByText('오늘 밤')).toBeOnTheScreen();
    expect(screen.getByText('Tonight')).toBeOnTheScreen();
    expect(screen.getByText('전체 챕터')).toBeOnTheScreen();
    expect(screen.getByText('All chapters')).toBeOnTheScreen();
    expect(screen.getByText('오늘 밤 챕터가 준비됐어요')).toBeOnTheScreen();
    expect(screen.getByText('Tonight\'s chapter is ready')).toBeOnTheScreen();
    expect(screen.getByText('함께 읽기 · Read together')).toBeOnTheScreen();
  });

  it('shows the awaiting-review card in both languages', async () => {
    mockGetNightlyState.mockResolvedValue({
      kind: 'awaiting_review',
      chapterId: 'ch-2',
      title: 'The Quiet Bridge',
    });
    setup(<TonightScreen />);

    expect(await screen.findByText('확인을 기다리고 있어요')).toBeOnTheScreen();
    expect(screen.getByText('Waiting for you')).toBeOnTheScreen();
    expect(screen.getByText('먼저 읽어보기 · Read it first')).toBeOnTheScreen();
  });

  it('shows the failed card in both languages, with the server error shown once and untranslated', async () => {
    mockGetNightlyState.mockResolvedValue({
      kind: 'failed',
      job: { ...job, status: 'failed', error: 'provider unavailable' },
    });
    setup(<TonightScreen />);

    expect(await screen.findByText('이번엔 완성되지 못했어요')).toBeOnTheScreen();
    expect(screen.getByText('That one didn\'t come out')).toBeOnTheScreen();
    expect(screen.getByText('다시 시도 · Try again')).toBeOnTheScreen();
    // The server's own error string is shown once, verbatim.
    expect(screen.getAllByText('provider unavailable')).toHaveLength(1);
  });

  it('shows the offline-empty card in both languages', async () => {
    mockGetNightlyState.mockResolvedValue({ kind: 'offline_empty' });
    setup(<TonightScreen />);

    expect(await screen.findByText('연결이 없고 저장된 것도 없어요')).toBeOnTheScreen();
    expect(screen.getByText('No connection, and nothing saved yet')).toBeOnTheScreen();
  });

  it('shows the writing card in both languages and forwards the wire-value lesson verbatim, never translated', async () => {
    mockGetNightlyState.mockResolvedValue({
      kind: 'writing',
      job: { ...job, auto_chosen: true },
    });
    setup(<TonightScreen />);

    expect(await screen.findByText('내일 챕터를 쓰고 있어요')).toBeOnTheScreen();
    expect(screen.getByText('Writing tomorrow\'s chapter')).toBeOnTheScreen();
    // `job.lesson` is a wire value: shown once, verbatim in English, never
    // translated or table-mapped — even though Korean is leading.
    expect(screen.getAllByText(/being brave about something new/)).toHaveLength(1);
    expect(screen.getByText(/저희가 대신 골랐어요/)).toBeOnTheScreen();
  });
});
