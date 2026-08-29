import * as React from 'react';

import { Text, View } from '@/components/ui';

const EN = 'Made with AI, reviewed by a parent';
const KO = 'AI로 제작되었고, 보호자가 검토했어요';

/**
 * A small, unobtrusive AI-generated disclosure (issue #12) — both languages
 * always render, lead first, matching the reader's own bilingual convention
 * (ADR-0001 §1) rather than inventing a second bilingual pattern.
 */
export function AiGeneratedBadge({ lead }: { lead: 'en' | 'ko' }) {
  return (
    <View testID="ai-generated-badge" className="gap-0.5">
      <Text className="text-xs text-neutral-500">
        {lead === 'ko' ? KO : EN}
      </Text>
      <Text className="text-xs text-neutral-400">
        {lead === 'ko' ? EN : KO}
      </Text>
    </View>
  );
}
