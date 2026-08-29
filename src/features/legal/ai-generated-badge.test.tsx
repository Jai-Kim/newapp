import * as React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';
import { AiGeneratedBadge } from './ai-generated-badge';

afterEach(() => {
  cleanup();
});

describe('aiGeneratedBadge', () => {
  it('leads with English and still shows Korean beneath', () => {
    setup(<AiGeneratedBadge lead="en" />);

    const [first, second] = screen.getAllByText(/Made with AI|AI로 제작되었고/);
    expect(first).toHaveTextContent('Made with AI, reviewed by a parent');
    expect(second).toHaveTextContent('AI로 제작되었고, 보호자가 검토했어요');
  });

  it('leads with Korean and still shows English beneath', () => {
    setup(<AiGeneratedBadge lead="ko" />);

    const [first, second] = screen.getAllByText(/Made with AI|AI로 제작되었고/);
    expect(first).toHaveTextContent('AI로 제작되었고, 보호자가 검토했어요');
    expect(second).toHaveTextContent('Made with AI, reviewed by a parent');
  });
});
