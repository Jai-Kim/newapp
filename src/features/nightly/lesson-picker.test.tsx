import * as React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';
import { LESSONS, LessonPicker } from './lesson-picker';

/**
 * Bilingual EN+KO coverage (ADR-0001 §1) for the one screen in the nightly
 * loop that renders directly inside `TheEnd` every night (issue #22).
 *
 * The regression that matters most here is the wire-value one: `LESSONS`
 * entries are screened server-side by exact string match
 * (`supabase/functions/_shared/lessons.ts`, `FALLBACK_LESSONS`) to skip a
 * needless crisis-screening model call on the common path. A future change
 * that starts sending the Korean label instead of the English `value` would
 * silently turn every ordinary lesson into free text on that path — the
 * chip-selection test below asserts `onChoose` still receives the raw
 * English value, not the display label.
 */

const mockOnChoose = jest.fn();

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('lessonPicker — bilingual chrome', () => {
  it('renders the heading, field label, and input label bilingually, English-led', () => {
    setup(<LessonPicker name="Mia" busy={false} lead="en" onChoose={mockOnChoose} />);

    expect(screen.getByText('What should tomorrow be about?')).toBeOnTheScreen();
    expect(screen.getByText('내일은 어떤 이야기를 들려줄까요?')).toBeOnTheScreen();
    expect(
      screen.getByText('Tomorrow\'s lesson · 내일 이야기 주제'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Anything happening tomorrow? · 내일 특별한 일이 있나요?'),
    ).toBeOnTheScreen();
  });

  it('renders the heading, field label, and input label bilingually, Korean-led', () => {
    setup(<LessonPicker name="유나" busy={false} lead="ko" onChoose={mockOnChoose} />);

    expect(screen.getByText('내일은 어떤 이야기를 들려줄까요?')).toBeOnTheScreen();
    expect(screen.getByText('What should tomorrow be about?')).toBeOnTheScreen();
    expect(
      screen.getByText('내일 이야기 주제 · Tomorrow\'s lesson'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('내일 특별한 일이 있나요? · Anything happening tomorrow?'),
    ).toBeOnTheScreen();
  });

  it('renders both button labels bilingually, English-led', () => {
    setup(<LessonPicker name="Mia" busy={false} lead="en" onChoose={mockOnChoose} />);

    expect(
      screen.getByText('Write tomorrow\'s chapter · 내일 이야기 쓰기'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('You choose for me · 저 대신 골라 주세요'),
    ).toBeOnTheScreen();
  });

  it('renders both button labels bilingually, Korean-led', () => {
    setup(<LessonPicker name="유나" busy={false} lead="ko" onChoose={mockOnChoose} />);

    expect(
      screen.getByText('내일 이야기 쓰기 · Write tomorrow\'s chapter'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('저 대신 골라 주세요 · You choose for me'),
    ).toBeOnTheScreen();
  });

  it('shows the busy label bilingually while a request is in flight', () => {
    setup(<LessonPicker name="Mia" busy lead="en" onChoose={mockOnChoose} />);

    expect(screen.getByText('Starting… · 시작하는 중…')).toBeOnTheScreen();
  });
});

describe('lessonPicker — testIDs and the wire-value contract', () => {
  it('resolves every existing testID', () => {
    setup(<LessonPicker name="Mia" busy={false} lead="en" onChoose={mockOnChoose} />);

    expect(screen.getByTestId('situation')).toBeOnTheScreen();
    expect(screen.getByTestId('sensitive-topic-disclaimer')).toBeOnTheScreen();
    expect(screen.getByTestId('queue-tomorrow')).toBeOnTheScreen();
    expect(screen.getByTestId('queue-auto')).toBeOnTheScreen();
    for (const lesson of LESSONS) {
      expect(
        screen.getByTestId(`lesson-${lesson.value.slice(0, 12)}`),
      ).toBeOnTheScreen();
    }
  });

  it('sends the English wire value to onChoose, never the Korean label, when a chip is tapped', async () => {
    const { user } = setup(
      <LessonPicker name="Mia" busy={false} lead="ko" onChoose={mockOnChoose} />,
    );

    const target = LESSONS[2];
    await user.press(screen.getByTestId(`lesson-${target.value.slice(0, 12)}`));
    await user.press(screen.getByTestId('queue-tomorrow'));

    expect(mockOnChoose).toHaveBeenCalledWith(target.value, undefined);
  });

  it('"You choose for me" still queues something, with no lesson chosen', async () => {
    const { user } = setup(
      <LessonPicker name="Mia" busy={false} lead="en" onChoose={mockOnChoose} />,
    );

    await user.press(screen.getByTestId('queue-auto'));

    expect(mockOnChoose).toHaveBeenCalledWith(undefined, undefined);
  });

  it('trims a typed situation and forwards it alongside the chosen lesson', async () => {
    const { user } = setup(
      <LessonPicker name="Mia" busy={false} lead="en" onChoose={mockOnChoose} />,
    );

    const target = LESSONS[0];
    await user.press(screen.getByTestId(`lesson-${target.value.slice(0, 12)}`));
    await user.type(screen.getByTestId('situation'), '  first swim lesson  ');
    await user.press(screen.getByTestId('queue-tomorrow'));

    expect(mockOnChoose).toHaveBeenCalledWith(target.value, 'first swim lesson');
  });

  it('disables "Write tomorrow\'s chapter" until a lesson is chosen', () => {
    setup(<LessonPicker name="Mia" busy={false} lead="en" onChoose={mockOnChoose} />);

    expect(screen.getByTestId('queue-tomorrow')).toBeDisabled();
  });
});
