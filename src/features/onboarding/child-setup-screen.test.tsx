import * as React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';
import { ChildSetupScreen } from './child-setup-screen';

/**
 * The PIPA-shaped consent gate this slice adds (issue #12): a parent cannot
 * create a child profile — and so cannot trigger any generation — without
 * explicitly consenting, and the version consented to is recorded against
 * the family via `createFamilyAndChild`.
 */

const mockCreateFamilyAndChild = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  // eslint-disable-next-line react/no-unnecessary-use-prefix -- mocking expo-router's actual export name
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock('@/lib/supabase/onboarding', () => ({
  createFamilyAndChild: (...args: unknown[]) => mockCreateFamilyAndChild(...args),
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('childSetupScreen — privacy consent gate', () => {
  it('keeps Continue disabled until the name is filled and consent is checked', async () => {
    const { user } = setup(<ChildSetupScreen />);

    expect(screen.getByTestId('create-child')).toBeDisabled();

    await user.type(screen.getByTestId('child-name'), 'Mia');
    expect(screen.getByTestId('create-child')).toBeDisabled();

    await user.press(screen.getByTestId('privacy-consent'));
    expect(screen.getByTestId('create-child')).toBeEnabled();
  });

  it('blocks submission if consent is unchecked even with a name typed', async () => {
    const { user } = setup(<ChildSetupScreen />);

    await user.type(screen.getByTestId('child-name'), 'Mia');
    await user.press(screen.getByTestId('create-child'));

    expect(mockCreateFamilyAndChild).not.toHaveBeenCalled();
  });

  it('records the consent version alongside the child draft on submit', async () => {
    mockCreateFamilyAndChild.mockResolvedValue({ id: 'child-1' });
    const { user } = setup(<ChildSetupScreen />);

    await user.type(screen.getByTestId('child-name'), 'Mia');
    await user.press(screen.getByTestId('privacy-consent'));
    await user.press(screen.getByTestId('create-child'));

    expect(mockCreateFamilyAndChild).toHaveBeenCalledWith(
      expect.objectContaining({ first_name: 'Mia' }),
      { version: expect.any(String) },
    );
  });

  it('shows the consent items bilingually, including the cross-border transfer called out on its own', () => {
    setup(<ChildSetupScreen />);

    expect(screen.getByText(/Purpose: writing and illustrating/)).toBeOnTheScreen();
    expect(screen.getByText(/이용 목적: 아이의 동화를/)).toBeOnTheScreen();
    expect(screen.getByText(/Cross-border transfer: what you type/)).toBeOnTheScreen();
    expect(screen.getByText(/국외 이전: 입력하신 내용은/)).toBeOnTheScreen();
    expect(screen.getByText(/Your right to refuse/)).toBeOnTheScreen();
  });

  it('links to the full privacy notice', async () => {
    const { user } = setup(<ChildSetupScreen />);

    await user.press(screen.getByTestId('privacy-read-more'));
    expect(mockPush).toHaveBeenCalledWith('/privacy');
  });
});

/**
 * This is the first screen a parent ever sees, and the one where a
 * Korean-dominant parent tells us so by tapping a chip — before that tap,
 * `lead` is `'en'`. So unlike #41–#44, the interesting assertion here is a
 * state transition (before/after `lang-ko`), not just a static render.
 */
describe('childSetupScreen — bilingual chrome (issue #22, ADR-0001 §1/§3)', () => {
  it('shows English-led chrome by default, with both languages present', () => {
    setup(<ChildSetupScreen />);

    expect(screen.getByText('Who is the story about?')).toBeOnTheScreen();
    expect(screen.getByText('누구의 이야기를 들려드릴까요?')).toBeOnTheScreen();
    expect(screen.getByText('Your child is the hero of every chapter.')).toBeOnTheScreen();
    expect(screen.getByText('아이가 모든 챕터의 주인공이에요.')).toBeOnTheScreen();
    expect(screen.getByText('Their first name · 아이의 이름')).toBeOnTheScreen();
    expect(screen.getByText('How old are they? · 나이가 어떻게 되나요?')).toBeOnTheScreen();
    expect(screen.getByText('Which language reads first? · 어떤 언어가 먼저 나올까요?')).toBeOnTheScreen();
    expect(screen.getByText('What do they love? · 무엇을 좋아하나요?')).toBeOnTheScreen();
    expect(screen.getByText('dinosaurs · 공룡')).toBeOnTheScreen();
    expect(screen.getByText('Continue · 계속하기')).toBeOnTheScreen();
  });

  it('re-orders every combined label live once lang-ko is tapped, still showing both languages', async () => {
    const { user } = setup(<ChildSetupScreen />);

    expect(screen.getByText('Their first name · 아이의 이름')).toBeOnTheScreen();
    expect(screen.queryByText('아이의 이름 · Their first name')).not.toBeOnTheScreen();

    await user.press(screen.getByTestId('lang-ko'));

    expect(screen.getByText('아이의 이름 · Their first name')).toBeOnTheScreen();
    expect(screen.queryByText('Their first name · 아이의 이름')).not.toBeOnTheScreen();
    expect(screen.getByText('나이가 어떻게 되나요? · How old are they?')).toBeOnTheScreen();
    expect(screen.getByText('어떤 언어가 먼저 나올까요? · Which language reads first?')).toBeOnTheScreen();
    expect(screen.getByText('무엇을 좋아하나요? · What do they love?')).toBeOnTheScreen();
    expect(screen.getByText('공룡 · dinosaurs')).toBeOnTheScreen();
    expect(screen.getByText('계속하기 · Continue')).toBeOnTheScreen();
    // The paired heading Text still shows both — only which one leads changes.
    expect(screen.getByText('누구의 이야기를 들려드릴까요?')).toBeOnTheScreen();
    expect(screen.getByText('Who is the story about?')).toBeOnTheScreen();
  });

  it('shows both per-language hints for whichever language is currently selected', async () => {
    const { user } = setup(<ChildSetupScreen />);

    expect(screen.getByText('English reads first, Korean beneath')).toBeOnTheScreen();
    expect(screen.getByText('영어가 먼저, 그 아래 한국어가 나와요')).toBeOnTheScreen();

    await user.press(screen.getByTestId('lang-ko'));

    expect(screen.getByText('한국어가 먼저, 그 아래 영어가 나와요')).toBeOnTheScreen();
    expect(screen.getByText('Korean reads first, English beneath')).toBeOnTheScreen();
  });

  it('sends the English interest wire values to createFamilyAndChild, never the Korean display labels', async () => {
    mockCreateFamilyAndChild.mockResolvedValue({ id: 'child-1' });
    const { user } = setup(<ChildSetupScreen />);

    await user.press(screen.getByTestId('lang-ko'));
    await user.type(screen.getByTestId('child-name'), '지민');
    await user.press(screen.getByTestId('interest-dinosaurs'));
    await user.press(screen.getByTestId('interest-space'));
    await user.press(screen.getByTestId('privacy-consent'));
    await user.press(screen.getByTestId('create-child'));

    expect(mockCreateFamilyAndChild).toHaveBeenCalledWith(
      expect.objectContaining({
        primary_language: 'ko',
        interests: ['dinosaurs', 'space'],
      }),
      { version: expect.any(String) },
    );
  });
});
