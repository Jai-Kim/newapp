import type { ChildReadableChapter } from '@/lib/supabase/types';

import * as React from 'react';

import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';
import { LibraryScreen } from './library-screen';

/**
 * The Volume progress this slice adds (issue #22, ADR-0003): the library is
 * the shelf, so it is where "your book is filling up" and "your book is
 * ready" have to show.
 */

const mockListChildren = jest.fn();
const mockListReadableChapters = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/offline/chapter-cache', () => ({
  cacheChild: jest.fn(),
  readCachedChild: () => null,
  readCachedChapters: () => [],
}));

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
    title_ko: `${number}장`,
    lesson: null,
    situation: null,
    pages: [],
    summary: '',
    reviewed_at: null,
    read_at: null,
    created_at: '',
  };
}

describe('libraryScreen — Volume progress', () => {
  it('shows the current Volume filling up', async () => {
    mockListChildren.mockResolvedValue([
      { id: 'child-1', first_name: 'Yuna', primary_language: 'en' },
    ]);
    mockListReadableChapters.mockResolvedValue(
      Array.from({ length: 4 }, (_, i) => chapter(i + 1)),
    );
    setup(<LibraryScreen />);

    expect(await screen.findByTestId('volume-progress')).toBeOnTheScreen();
    expect(screen.getByText('Volume 1')).toBeOnTheScreen();
    expect(screen.getByText('4 of 10 chapters')).toBeOnTheScreen();
    expect(screen.queryByTestId('volume-complete')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('print-order-cta')).not.toBeOnTheScreen();
  });

  it('marks the volume complete at ten, bilingually, with an order-the-hardcover CTA', async () => {
    mockListChildren.mockResolvedValue([
      { id: 'child-1', first_name: 'Yuna', primary_language: 'en' },
    ]);
    mockListReadableChapters.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => chapter(i + 1)),
    );
    const { user } = setup(<LibraryScreen />);

    await waitFor(() =>
      expect(screen.getByTestId('volume-complete')).toBeOnTheScreen());
    expect(screen.getByText('10 of 10 chapters')).toBeOnTheScreen();
    expect(screen.getByText('Your book is ready!')).toBeOnTheScreen();
    expect(screen.getByText('책이 완성되었어요!')).toBeOnTheScreen();

    // Bilingual too (issue #22) — one label, both languages.
    const cta = screen.getByTestId('print-order-cta-label');
    expect(cta.props.children).toContain('Order / gift the hardcover');
    expect(cta.props.children).toContain('하드커버 주문 / 선물하기');

    await user.press(screen.getByTestId('print-order-cta'));
    expect(mockPush).toHaveBeenCalledWith('/print-order/1?childId=child-1&lead=en');
  });

  it('shows the ready banner in both languages for a Korean-led child too', async () => {
    mockListChildren.mockResolvedValue([
      { id: 'child-1', first_name: 'Yuna', primary_language: 'ko' },
    ]);
    mockListReadableChapters.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => chapter(i + 1)),
    );
    setup(<LibraryScreen />);

    await waitFor(() =>
      expect(screen.getByTestId('volume-complete')).toBeOnTheScreen());
    expect(screen.getByText('책이 완성되었어요!')).toBeOnTheScreen();
    expect(screen.getByText('Your book is ready!')).toBeOnTheScreen();
  });

  it('starts a second volume once the first is full', async () => {
    mockListChildren.mockResolvedValue([
      { id: 'child-1', first_name: 'Yuna', primary_language: 'en' },
    ]);
    mockListReadableChapters.mockResolvedValue(
      Array.from({ length: 11 }, (_, i) => chapter(i + 1)),
    );
    setup(<LibraryScreen />);

    await waitFor(() => expect(screen.getByText('Volume 2')).toBeOnTheScreen());
    expect(screen.getByText('1 of 10 chapters')).toBeOnTheScreen();
    expect(screen.queryByTestId('volume-complete')).not.toBeOnTheScreen();
  });

  it('shows no Volume card when the library is empty', async () => {
    mockListChildren.mockResolvedValue([
      { id: 'child-1', first_name: 'Yuna', primary_language: 'en' },
    ]);
    mockListReadableChapters.mockResolvedValue([]);
    setup(<LibraryScreen />);

    expect(await screen.findByText('Nothing to read yet')).toBeOnTheScreen();
    expect(screen.queryByTestId('volume-progress')).not.toBeOnTheScreen();
  });
});
