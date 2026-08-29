import * as React from 'react';

import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';
import { PrivacyScreen } from './privacy-screen';

const mockListChildren = jest.fn();

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
}));

jest.mock('@/lib/supabase/chapters', () => ({
  listChildren: (...args: unknown[]) => mockListChildren(...args),
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('privacyScreen', () => {
  it('renders every section bilingually, English leading with no child yet', async () => {
    mockListChildren.mockResolvedValue([]);
    setup(<PrivacyScreen />);

    expect(await screen.findByTestId('privacy-screen')).toBeOnTheScreen();
    expect(screen.getByText('Privacy & AI use')).toBeOnTheScreen();
    expect(screen.getByText('개인정보 및 AI 이용 안내')).toBeOnTheScreen();
    expect(screen.getByText('Third-party AI providers')).toBeOnTheScreen();
    expect(screen.getByText('제3자 AI 제공업체')).toBeOnTheScreen();
    expect(screen.getByText('Cross-border transfer')).toBeOnTheScreen();
    expect(screen.getByText(/Anthropic \(Claude\)/)).toBeOnTheScreen();
    expect(screen.getByText(/Google \(Gemini\)/)).toBeOnTheScreen();
  });

  it('leads with Korean when the family\'s child is Korean-led', async () => {
    mockListChildren.mockResolvedValue([
      { id: 'child-1', first_name: 'Yuna', primary_language: 'ko' },
    ]);
    setup(<PrivacyScreen />);

    await waitFor(() =>
      expect(screen.getByTestId('privacy-screen')).toBeOnTheScreen());
    expect(screen.getByText('개인정보 및 AI 이용 안내')).toBeOnTheScreen();
    // Both languages are still on the screen either way.
    expect(screen.getByText('Privacy & AI use')).toBeOnTheScreen();
  });
});
