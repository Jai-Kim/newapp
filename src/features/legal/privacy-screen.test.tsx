import * as React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';
import { PrivacyScreen } from './privacy-screen';

afterEach(cleanup);

describe('privacyScreen (issue #12)', () => {
  it('renders bilingually and names both third-party AI providers plainly', () => {
    setup(<PrivacyScreen />);

    expect(screen.getByTestId('privacy-screen')).toBeOnTheScreen();
    expect(screen.getByText('Privacy & data')).toBeOnTheScreen();
    expect(screen.getByText('개인정보 및 데이터')).toBeOnTheScreen();

    // Named directly, not "our partners" — the driver's explicit instruction.
    expect(screen.getByText(/Anthropic \(Claude models\) writes the text/)).toBeOnTheScreen();
    expect(screen.getByText(/Google \(Gemini models\) generates the illustrations/)).toBeOnTheScreen();
  });

  it('states chapters are AI-generated', () => {
    setup(<PrivacyScreen />);

    expect(screen.getByText('Chapters are AI-generated')).toBeOnTheScreen();
    expect(screen.getByText('챕터는 AI가 만들어요')).toBeOnTheScreen();
  });

  it('discloses the cross-border transfer as its own section (Korea PIPA)', () => {
    setup(<PrivacyScreen />);

    expect(screen.getByText('Cross-border transfer (Korea PIPA)')).toBeOnTheScreen();
    expect(screen.getByText('국외 이전 (개인정보보호법)')).toBeOnTheScreen();
  });

  it('marks itself as a draft, not legal advice', () => {
    setup(<PrivacyScreen />);

    expect(
      screen.getByText('This is a draft for review, not final legal advice.'),
    ).toBeOnTheScreen();
  });
});
