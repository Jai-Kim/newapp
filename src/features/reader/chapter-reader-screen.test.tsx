import type { ChildReadableChapter } from '@/lib/supabase/types';

import * as React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';
import { ChapterReaderScreen } from './chapter-reader-screen';

/**
 * The AI-generated-content label (issue #12): every chapter shown to a
 * child carries a bilingual "Made with AI" disclosure on its title page.
 */

const mockUseChapterReader = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'chapter-1' }),
  useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/features/reader/use-chapter-reader', () => ({
  useChapterReader: (...args: unknown[]) => mockUseChapterReader(...args),
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

const chapter: ChildReadableChapter = {
  id: 'chapter-1',
  child_id: 'child-1',
  number: 1,
  title_en: 'The Quiet Night',
  title_ko: '조용한 밤',
  lesson: null,
  situation: null,
  pages: [
    {
      page: 1,
      en: 'Once upon a time.',
      ko: '옛날 옛적에.',
      scene: 'a bedroom at night',
      wardrobe: 'pyjamas',
    },
  ],
  summary: '',
  reviewed_at: null,
  read_at: null,
  created_at: '',
};

type ReaderState = {
  chapter: ChildReadableChapter | undefined;
  lead: 'en' | 'ko';
  name: string;
  index: number;
  finished: boolean;
  loading: boolean;
  busy: boolean;
  error: string | null;
  offline: boolean;
  next: () => void;
  previous: () => void;
  queueTomorrow: () => void;
  imageUrlFor: () => undefined;
};

function baseReader(overrides: Partial<ReaderState> = {}): ReaderState {
  return {
    chapter,
    lead: 'en',
    name: 'Yuna',
    index: 0,
    finished: false,
    loading: false,
    busy: false,
    error: null,
    offline: false,
    next: jest.fn(),
    previous: jest.fn(),
    queueTomorrow: jest.fn(),
    imageUrlFor: () => undefined,
    ...overrides,
  };
}

describe('chapterReaderScreen — AI-generated label', () => {
  it('shows a bilingual "made with AI" badge on the title page', () => {
    mockUseChapterReader.mockReturnValue(baseReader());
    setup(<ChapterReaderScreen />);

    expect(screen.getByTestId('ai-generated-badge')).toBeOnTheScreen();
    expect(screen.getByText('Made with AI, reviewed by a parent')).toBeOnTheScreen();
    expect(screen.getByText('AI로 제작되었고, 보호자가 검토했어요')).toBeOnTheScreen();
  });

  it('leads with Korean for a Korean-primary child, both still present', () => {
    mockUseChapterReader.mockReturnValue(baseReader({ lead: 'ko' }));
    setup(<ChapterReaderScreen />);

    expect(screen.getByText('AI로 제작되었고, 보호자가 검토했어요')).toBeOnTheScreen();
    expect(screen.getByText('Made with AI, reviewed by a parent')).toBeOnTheScreen();
  });

  it('does not show the badge on the loading state', () => {
    mockUseChapterReader.mockReturnValue(baseReader({ loading: true, chapter: undefined }));
    setup(<ChapterReaderScreen />);

    expect(screen.queryByTestId('ai-generated-badge')).not.toBeOnTheScreen();
  });
});
