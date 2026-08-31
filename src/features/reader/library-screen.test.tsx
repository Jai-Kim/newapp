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
const mockReadCachedChild = jest.fn();
const mockReadCachedChapters = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/offline/chapter-cache', () => ({
  cacheChild: jest.fn(),
  readCachedChild: (...args: unknown[]) => mockReadCachedChild(...args),
  readCachedChapters: (...args: unknown[]) => mockReadCachedChapters(...args),
}));

jest.mock('@/lib/supabase/chapters', () => ({
  listChildren: (...args: unknown[]) => mockListChildren(...args),
  listReadableChapters: (...args: unknown[]) => mockListReadableChapters(...args),
}));

beforeEach(() => {
  mockReadCachedChild.mockReturnValue(null);
  mockReadCachedChapters.mockReturnValue([]);
});

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
  it('shows the current Volume filling up, bilingually', async () => {
    mockListChildren.mockResolvedValue([
      { id: 'child-1', first_name: 'Yuna', primary_language: 'en' },
    ]);
    mockListReadableChapters.mockResolvedValue(
      Array.from({ length: 4 }, (_, i) => chapter(i + 1)),
    );
    setup(<LibraryScreen />);

    expect(await screen.findByTestId('volume-progress')).toBeOnTheScreen();
    expect(screen.getByText('Volume 1')).toBeOnTheScreen();
    expect(screen.getByText('1권')).toBeOnTheScreen();
    expect(screen.getByText('4 of 10 chapters')).toBeOnTheScreen();
    expect(screen.getByText('10장 중 4장')).toBeOnTheScreen();
    expect(screen.queryByTestId('volume-complete')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('print-order-cta')).not.toBeOnTheScreen();
  });

  it('leads with Korean for a Korean-first child, still showing both languages', async () => {
    mockListChildren.mockResolvedValue([
      { id: 'child-1', first_name: 'Yuna', primary_language: 'ko' },
    ]);
    mockListReadableChapters.mockResolvedValue(
      Array.from({ length: 4 }, (_, i) => chapter(i + 1)),
    );
    setup(<LibraryScreen />);

    expect(await screen.findByTestId('volume-progress')).toBeOnTheScreen();
    expect(screen.getByText('1권')).toBeOnTheScreen();
    expect(screen.getByText('Volume 1')).toBeOnTheScreen();
    expect(screen.getByText('10장 중 4장')).toBeOnTheScreen();
    expect(screen.getByText('4 of 10 chapters')).toBeOnTheScreen();
  });

  it('shows the screen header and an unread chapter label bilingually', async () => {
    mockListChildren.mockResolvedValue([
      { id: 'child-1', first_name: 'Yuna', primary_language: 'en' },
    ]);
    mockListReadableChapters.mockResolvedValue([chapter(1)]);
    setup(<LibraryScreen />);

    expect(await screen.findByText('All chapters')).toBeOnTheScreen();
    expect(screen.getByText('전체 챕터')).toBeOnTheScreen();
    expect(screen.getByText('not read yet')).toBeOnTheScreen();
    expect(screen.getByText('아직 안 읽었어요')).toBeOnTheScreen();
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

  it('shows no Volume card when the library is empty, bilingually', async () => {
    mockListChildren.mockResolvedValue([
      { id: 'child-1', first_name: 'Yuna', primary_language: 'en' },
    ]);
    mockListReadableChapters.mockResolvedValue([]);
    setup(<LibraryScreen />);

    expect(await screen.findByText('Nothing to read yet')).toBeOnTheScreen();
    expect(screen.getByText('아직 읽을 챕터가 없어요')).toBeOnTheScreen();
    expect(
      screen.getByText('Chapters appear here once a grown-up has read them and said yes.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('어른이 먼저 읽고 괜찮다고 하면 여기에 챕터가 나타나요.'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('volume-progress')).not.toBeOnTheScreen();
  });

  it('shows a bilingual offline notice when the network fails but a cached child exists', async () => {
    mockReadCachedChild.mockReturnValue(
      { id: 'child-1', first_name: 'Yuna', primary_language: 'en' },
    );
    mockReadCachedChapters.mockReturnValue([chapter(1)]);
    mockListChildren.mockRejectedValue(new Error('network down'));
    setup(<LibraryScreen />);

    expect(await screen.findByTestId('library-offline')).toBeOnTheScreen();
    expect(
      screen.getByText('Offline — showing the chapters saved on this device.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('오프라인이에요 — 기기에 저장된 챕터를 보여드려요.'),
    ).toBeOnTheScreen();
  });
});
