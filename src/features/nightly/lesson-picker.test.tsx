import * as React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';
import { LessonPicker, LESSONS } from './lesson-picker';

/**
 * Bilingual chrome for the last screen before a parent commits to tomorrow
 * (issue #22, follow-up to #41/#42) — `LessonPicker` renders inside `TheEnd`
 * every single night, so it does not get to be English-only. Both languages
 * must always render; `lead` only decides which one is emphasized.
 *
 * The regression that matters most is the wire-value one: `LESSONS.value`
 * mirrors the server's `FALLBACK_LESSONS` byte for byte and is what
 * `onChoose` forwards toward `generate-chapter`, so a chip tap must still
 * hand back the English string even when Korean is what's on screen.
 */

const mockOnChoose = jest.fn();

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('lessonPicker — bilingual chrome, English-led', () => {
  it('shows the heading, field, input, hint and disclaimer in both languages', () => {
    setup(<LessonPicker name="Mia" busy={false} lead="en" onChoose={mockOnChoose} />);

    expect(screen.getByText('What should tomorrow be about?')).toBeOnTheScreen();
    expect(screen.getByText('내일은 어떤 이야기를 들려줄까요?')).toBeOnTheScreen();
    expect(
      screen.getByText('We\'ll write it tonight, so it\'s ready the moment you sit down tomorrow.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('오늘 밤 미리 써 둘게요. 내일 앉자마자 바로 읽을 수 있어요.'),
    ).toBeOnTheScreen();

    expect(screen.getByText('Tomorrow\'s lesson · 내일 이야기의 주제')).toBeOnTheScreen();

    expect(screen.getByText('Anything happening tomorrow? · 내일 무슨 일 있나요?')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('First swim lesson · 예: 첫 수영 수업')).toBeOnTheScreen();

    expect(
      screen.getByText(`Optional. Gives Mia's chapter something real to hold on to.`),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('선택이에요. Mia의 이야기에 진짜 있었던 일을 살짝 담아 드려요.'),
    ).toBeOnTheScreen();

    expect(screen.getByTestId('sensitive-topic-disclaimer')).toBeOnTheScreen();
  });

  it('shows both button labels bilingually', () => {
    setup(<LessonPicker name="Mia" busy={false} lead="en" onChoose={mockOnChoose} />);

    const writeLabel = screen.getByTestId('queue-tomorrow-label');
    expect(writeLabel.props.children).toContain('Write tomorrow\'s chapter');
    expect(writeLabel.props.children).toContain('내일 이야기 쓰기');

    const autoLabel = screen.getByTestId('queue-auto-label');
    expect(autoLabel.props.children).toContain('You choose for me');
    expect(autoLabel.props.children).toContain('저 대신 골라 주세요');
  });

  it('shows the busy label bilingually once a lesson is chosen and submitted', async () => {
    const { user } = setup(
      <LessonPicker name="Mia" busy onChoose={mockOnChoose} lead="en" />,
    );

    const writeLabel = screen.getByTestId('queue-tomorrow-label');
    expect(writeLabel.props.children).toContain('Starting…');
    expect(writeLabel.props.children).toContain('시작할게요…');
    // Busy also disables both buttons, regardless of whether a lesson is chosen.
    await user.press(screen.getByTestId('queue-auto'));
    expect(mockOnChoose).not.toHaveBeenCalled();
  });
});

describe('lessonPicker — bilingual chrome, Korean-led', () => {
  it('leads with Korean; both languages still present', () => {
    setup(<LessonPicker name="유나" busy={false} lead="ko" onChoose={mockOnChoose} />);

    expect(screen.getByText('내일은 어떤 이야기를 들려줄까요?')).toBeOnTheScreen();
    expect(screen.getByText('What should tomorrow be about?')).toBeOnTheScreen();

    expect(screen.getByText('내일 이야기의 주제 · Tomorrow\'s lesson')).toBeOnTheScreen();
    expect(screen.getByText('내일 무슨 일 있나요? · Anything happening tomorrow?')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('예: 첫 수영 수업 · First swim lesson')).toBeOnTheScreen();

    expect(
      screen.getByText('선택이에요. 유나의 이야기에 진짜 있었던 일을 살짝 담아 드려요.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(`Optional. Gives 유나's chapter something real to hold on to.`),
    ).toBeOnTheScreen();

    const writeLabel = screen.getByTestId('queue-tomorrow-label');
    expect(writeLabel.props.children).toContain('내일 이야기 쓰기');
    expect(writeLabel.props.children).toContain('Write tomorrow\'s chapter');
  });
});

describe('lessonPicker — the lesson chips', () => {
  it('renders all ten chips with stable, English-derived testIDs', () => {
    setup(<LessonPicker name="Mia" busy={false} lead="en" onChoose={mockOnChoose} />);

    for (const l of LESSONS) {
      expect(screen.getByTestId(`lesson-${l.value.slice(0, 12)}`)).toBeOnTheScreen();
    }
  });

  it('sends the English wire value to onChoose when a chip is tapped, even Korean-led', async () => {
    const { user } = setup(
      <LessonPicker name="Mia" busy={false} lead="ko" onChoose={mockOnChoose} />,
    );

    const brave = LESSONS.find(l => l.value === 'being brave about something new')!;
    await user.press(screen.getByTestId(`lesson-${brave.value.slice(0, 12)}`));
    await user.press(screen.getByTestId('queue-tomorrow'));

    expect(mockOnChoose).toHaveBeenCalledWith('being brave about something new', undefined);
  });

  it('disables the write button until a lesson is chosen', async () => {
    const { user } = setup(
      <LessonPicker name="Mia" busy={false} lead="en" onChoose={mockOnChoose} />,
    );

    await user.press(screen.getByTestId('queue-tomorrow'));
    expect(mockOnChoose).not.toHaveBeenCalled();
  });

  it('"you choose for me" still queues without a lesson chosen', async () => {
    const { user } = setup(
      <LessonPicker name="Mia" busy={false} lead="en" onChoose={mockOnChoose} />,
    );

    await user.press(screen.getByTestId('queue-auto'));
    expect(mockOnChoose).toHaveBeenCalledWith(undefined, undefined);
  });

  it('forwards a trimmed situation alongside the chosen lesson', async () => {
    const { user } = setup(
      <LessonPicker name="Mia" busy={false} lead="en" onChoose={mockOnChoose} />,
    );

    const brave = LESSONS.find(l => l.value === 'being brave about something new')!;
    await user.press(screen.getByTestId(`lesson-${brave.value.slice(0, 12)}`));
    await user.type(screen.getByTestId('situation'), '  first day of school  ');
    await user.press(screen.getByTestId('queue-tomorrow'));

    expect(mockOnChoose).toHaveBeenCalledWith(
      'being brave about something new',
      'first day of school',
    );
  });
});
