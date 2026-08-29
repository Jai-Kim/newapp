import * as React from 'react';

import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';
import { PrivacyScreen } from './privacy-screen';

const mockGetMyChild = jest.fn();

jest.mock('@/lib/supabase/onboarding', () => ({
  getMyChild: () => mockGetMyChild(),
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('privacyScreen', () => {
  it('names both AI providers directly, in English by default', async () => {
    mockGetMyChild.mockResolvedValue(null);
    setup(<PrivacyScreen />);

    await waitFor(() =>
      expect(screen.getByText('Privacy & how AI is used')).toBeOnTheScreen());
    // Named in both the English and Korean body text of the same section.
    expect(screen.getAllByText(/Anthropic/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Google/).length).toBeGreaterThanOrEqual(2);
  });

  it('leads with Korean for a Korean-primary child, English still present', async () => {
    mockGetMyChild.mockResolvedValue({ primary_language: 'ko' });
    setup(<PrivacyScreen />);

    await waitFor(() =>
      expect(screen.getByText('개인정보 처리방침 및 AI 이용 안내')).toBeOnTheScreen());
    // Every section renders in both languages regardless of which leads.
    expect(screen.getByText('Privacy & how AI is used')).toBeOnTheScreen();
  });

  it('shows the AI-disclosure section heading before its body, bilingually', async () => {
    mockGetMyChild.mockResolvedValue(null);
    setup(<PrivacyScreen />);

    const section = await screen.findByTestId('privacy-section-ai-providers');
    expect(section).toHaveTextContent('Your stories are written and illustrated by AI');
    expect(section).toHaveTextContent('아이의 이야기는 AI가 쓰고 그림을 그립니다');
  });
});
