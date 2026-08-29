import * as React from 'react';

import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';
import { ChildSetupScreen } from './child-setup-screen';

/**
 * PIPA requires separate, explicit parental consent before a child's data is
 * collected (issue #12) — this is the gate that enforces it: `Continue`
 * cannot be pressed until the consent box is checked, regardless of what
 * else has been filled in.
 */

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockCreateFamilyAndChild = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

jest.mock('@/lib/supabase/onboarding', () => ({
  createFamilyAndChild: (...args: unknown[]) => mockCreateFamilyAndChild(...args),
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

async function fillName(user: ReturnType<typeof setup>['user'], name: string) {
  await user.type(screen.getByTestId('child-name'), name);
}

describe('childSetupScreen — consent gate (issue #12)', () => {
  it('keeps Continue disabled with a name but no consent', async () => {
    const { user } = setup(<ChildSetupScreen />);
    await fillName(user, 'Mia');
    expect(screen.getByTestId('create-child')).toBeDisabled();
  });

  it('keeps Continue disabled with consent but no name', async () => {
    const { user } = setup(<ChildSetupScreen />);
    await user.press(screen.getByTestId('privacy-consent'));
    expect(screen.getByTestId('create-child')).toBeDisabled();
  });

  it('enables Continue once both a name and consent are given', async () => {
    const { user } = setup(<ChildSetupScreen />);
    await fillName(user, 'Mia');
    await user.press(screen.getByTestId('privacy-consent'));
    expect(screen.getByTestId('create-child')).toBeEnabled();
  });

  it('records which privacy-notice version was consented to, and when', async () => {
    mockCreateFamilyAndChild.mockResolvedValue({ id: 'child-1' });
    const { user } = setup(<ChildSetupScreen />);
    await fillName(user, 'Mia');
    await user.press(screen.getByTestId('privacy-consent'));
    await user.press(screen.getByTestId('create-child'));

    await waitFor(() => expect(mockCreateFamilyAndChild).toHaveBeenCalledTimes(1));
    const draft = mockCreateFamilyAndChild.mock.calls[0][0];
    expect(draft.privacy_consent_version).toEqual(expect.any(String));
    expect(draft.privacy_consent_version.length).toBeGreaterThan(0);
    expect(() => new Date(draft.privacy_consented_at).toISOString()).not.toThrow();
  });

  it('shows the consent statement bilingually', () => {
    setup(<ChildSetupScreen />);
    expect(
      screen.getByText(/parent or legal guardian/i),
    ).toBeOnTheScreen();
    expect(screen.getByText(/법정대리인/)).toBeOnTheScreen();
  });

  it('links to the full privacy notice', async () => {
    const { user } = setup(<ChildSetupScreen />);
    await user.press(screen.getByTestId('read-privacy-notice'));
    expect(mockPush).toHaveBeenCalledWith('/privacy');
  });
});
