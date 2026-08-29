import * as React from 'react';

import { PRIVACY_POLICY_VERSION } from '@/features/legal/privacy-content';
import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';
import { ChildSetupScreen } from './child-setup-screen';

/**
 * Explicit parental consent (issue #12) gates Continue on this screen the
 * same way the child's name already does — checked here because it is the
 * first, and only, place that gate exists.
 */

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockCreateFamilyAndChild = jest.fn();
const mockRecordPrivacyConsent = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock('@/lib/supabase/onboarding', () => ({
  createFamilyAndChild: (...args: unknown[]) => mockCreateFamilyAndChild(...args),
}));

jest.mock('@/lib/supabase/privacy', () => ({
  recordPrivacyConsent: (...args: unknown[]) => mockRecordPrivacyConsent(...args),
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
    expect(screen.getByTestId('create-child')).not.toBeDisabled();
  });

  it('records consent against the new family once the child is created', async () => {
    mockCreateFamilyAndChild.mockResolvedValue({
      id: 'child-1',
      family_id: 'family-1',
    });
    const { user } = setup(<ChildSetupScreen />);

    await user.type(screen.getByTestId('child-name'), 'Mia');
    await user.press(screen.getByTestId('privacy-consent'));
    await user.press(screen.getByTestId('create-child'));

    await waitFor(() =>
      expect(mockRecordPrivacyConsent)
        .toHaveBeenCalledWith('family-1', PRIVACY_POLICY_VERSION));
    expect(mockReplace).toHaveBeenCalledWith('/character-setup');
  });

  it('opens the full privacy notice on request', async () => {
    const { user } = setup(<ChildSetupScreen />);

    await user.press(screen.getByTestId('read-privacy-notice'));
    expect(mockPush).toHaveBeenCalledWith('/privacy');
  });
});
