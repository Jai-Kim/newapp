import * as React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';
import { AiGeneratedBadge } from './ai-generated-badge';

afterEach(cleanup);

describe('aiGeneratedBadge', () => {
  it('shows both languages, English leading by default', () => {
    setup(<AiGeneratedBadge />);
    expect(screen.getByTestId('ai-generated-badge')).toBeOnTheScreen();
    expect(screen.getByText('Made with AI, reviewed by a parent')).toBeOnTheScreen();
    expect(screen.getByText('AI로 제작 · 부모님이 검토했어요')).toBeOnTheScreen();
  });

  it('leads with Korean when asked to', () => {
    setup(<AiGeneratedBadge lead="ko" />);
    expect(screen.getByText('AI로 제작 · 부모님이 검토했어요')).toBeOnTheScreen();
    expect(screen.getByText('Made with AI, reviewed by a parent')).toBeOnTheScreen();
  });
});
