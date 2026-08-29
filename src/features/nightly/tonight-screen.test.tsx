import * as React from 'react';

import { GenerationQuotaError } from '@/lib/supabase/nightly';
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

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  // The screen refetches on focus; in a test it is mounted once, so running
  // the callback on mount is the same thing.
  useFocusEffect: (cb: () => void) => {
    require('react').useEffect(cb, [cb]);
  },
}));

jest.mock('@/lib/supabase/chapters', () => ({
  listChildren: async () => [
    { id: 'child-1', first_name: 'Yuna', primary_language: 'ko' },
  ],
}));

// A self-contained stand-in, not the real class from '@/lib/supabase/nightly'
// — that module also constructs the real Supabase client at import time
// (client.ts), which no test in this suite loads. use-nightly.ts's `e
// instanceof GenerationQuotaError` and this file both resolve the mocked
// module, so as long as both sides use this same constructor it works
// identically to the real one for the purpose of this test.
jest.mock('@/lib/supabase/nightly', () => {
  // Explicit field declarations, not TS parameter properties: Babel lowers
  // parameter properties into constructor-body assignments that reference
  // the bare parameter identifiers, and babel-plugin-jest-hoist rejects any
  // hoisted jest.mock factory that appears to close over an out-of-scope
  // variable — it can't tell those identifiers apart from real closures.
  class GenerationQuotaError extends Error {
    code: 'rate_limited' | 'monthly_quota_reached';
    messageEn: string;
    messageKo: string;
    resetsAt?: string;

    constructor(
      code: 'rate_limited' | 'monthly_quota_reached',
      messageEn: string,
      messageKo: string,
      resetsAt?: string,
    ) {
      super(messageEn);
      this.name = 'GenerationQuotaError';
      this.code = code;
      this.messageEn = messageEn;
      this.messageKo = messageKo;
      this.resetsAt = resetsAt;
    }
  }
  return {
    getNightlyState: () => mockGetNightlyState(),
    enqueueTomorrow: (...args: unknown[]) => mockEnqueueTomorrow(...(args as [])),
    sweepQueue: async () => 0,
    GenerationQuotaError,
  };
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

    // "You choose for me" must still queue something — a family that skips the
    // prompt should wake up to a chapter, not to nothing.
    await user.press(screen.getByTestId('queue-auto'));
    await waitFor(() =>
      expect(mockEnqueueTomorrow).toHaveBeenCalledWith('child-1', undefined, undefined));
  });

  it('shows a warm, bilingual notice — not a red error — when the spend guard blocks a new chapter', async () => {
    mockGetNightlyState.mockResolvedValue({ kind: 'empty' });
    mockEnqueueTomorrow.mockRejectedValueOnce(
      new GenerationQuotaError(
        'monthly_quota_reached',
        "This month's book is already full of chapters.",
        '이번 달 책이 이야기로 가득 찼어요!',
      ),
    );
    const { user } = setup(<TonightScreen />);

    await user.press(await screen.findByTestId('queue-auto'));

    const notice = await screen.findByTestId('quota-notice');
    expect(notice).toBeOnTheScreen();
    // Both languages render regardless of which leads, per ADR-0001 §1.
    expect(screen.getByText(/full of chapters/)).toBeOnTheScreen();
    expect(screen.getByText('이번 달 책이 이야기로 가득 찼어요!')).toBeOnTheScreen();
  });
});
