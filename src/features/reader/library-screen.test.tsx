import type { ChildReadableChapter } from '@/lib/supabase/types';

import * as React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';
import { LibraryScreen } from './library-screen';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/offline/chapter-cache', () => ({
  cacheChild: jest.fn(),
  readCachedChild: () => null,
  readCachedChapters: () => [],
}));

const mockListChildren = jest.fn();
const mockListReadableChapters = jest.fn();

jest.mock('@/lib/supabase/chapters', () => ({
  listChildren: (...args: unknown[]) => mockListChildren(...args),
  listReadableChapters: (...args: unknown[]) => mockListReadableChapters(...args),
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

function chapter(number: number): ChildReadableChapter {
  return {
    id: `ch-${number}`,
    child_id: 'child-1',
    number,
    title_en: `Chapter ${number}`,
    title_ko: `챕터 ${number}`,
    lesson: null,
    situation: null,
    pages: [],
    summary: '',
    reviewed_at: null,
    read_at: '2026-08-01T00:00:00Z',
    created_at: '',
  };
}

function mockFamily(
  count: number,
  primaryLanguage: 'en' | 'ko' = 'en',
) {
  mockListChildren.mockResolvedValue([
    { id: 'child-1', first_name: 'Yuna', primary_language: primaryLanguage },
  ]);
  mockListReadableChapters.mockResolvedValue(
    Array.from({ length: count }, (_, i) => chapter(i + 1)),
  );
}

describe('libraryScreen — volumes', () => {
  it('shows the current volume filling up, short of 10 chapters', async () => {
    mockFamily(6);
    setup(<LibraryScreen />);

    expect(await screen.findByTestId('volume-progress')).toBeOnTheScreen();
    expect(screen.getByText('Volume 1')).toBeOnTheScreen();
    expect(screen.getByText('6 of 10 chapters')).toBeOnTheScreen();
    expect(screen.queryByTestId('volume-complete')).not.toBeOnTheScreen();
  });

  it('marks the volume complete and shows "book ready" at 10 chapters', async () => {
    mockFamily(10);
    setup(<LibraryScreen />);

    await screen.findByTestId('volume-progress');
    expect(screen.getByTestId('volume-complete')).toBeOnTheScreen();
    expect(screen.getByText('Your book is ready!')).toBeOnTheScreen();
    expect(screen.getByText('10 of 10 chapters')).toBeOnTheScreen();
  });

  it('moves on to volume 2 once an 11th chapter arrives', async () => {
    mockFamily(11);
    setup(<LibraryScreen />);

    await screen.findByTestId('volume-progress');
    expect(screen.getByText('Volume 2')).toBeOnTheScreen();
    expect(screen.getByText('1 of 10 chapters')).toBeOnTheScreen();
    expect(screen.queryByTestId('volume-complete')).not.toBeOnTheScreen();
  });

  it('shows the volume in Korean first for a Korean-led child', async () => {
    mockFamily(10, 'ko');
    setup(<LibraryScreen />);

    await screen.findByTestId('volume-progress');
    // Both languages on the card, per ADR-0001 §3 — Korean leads, English follows.
    expect(screen.getByText('1권')).toBeOnTheScreen();
    expect(screen.getByText('Volume 1')).toBeOnTheScreen();
    expect(screen.getByText('챕터 10/10')).toBeOnTheScreen();
    expect(screen.getByText('책이 완성되었어요!')).toBeOnTheScreen();
  });

  it('shows no volume progress when there is nothing to read yet', async () => {
    mockFamily(0);
    setup(<LibraryScreen />);

    expect(await screen.findByText('Nothing to read yet')).toBeOnTheScreen();
    expect(screen.queryByTestId('volume-progress')).not.toBeOnTheScreen();
  });
});
