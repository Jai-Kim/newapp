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
