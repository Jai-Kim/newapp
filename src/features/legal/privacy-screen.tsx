import * as React from 'react';
import {
  FocusAwareStatusBar,
  ScrollView,
  Text,
  View,
} from '@/components/ui';

import {
  PRIVACY_POLICY_VERSION,
  PRIVACY_SECTIONS,
} from '@/features/legal/privacy-content';
import type { PrivacySection } from '@/features/legal/privacy-content';

/**
 * The privacy & data disclosure surface (issue #12), reachable from
 * Settings and linked from the onboarding consent step. Both languages
 * render in full, English then Korean, matching the always-both-languages
 * convention used everywhere story content appears (ADR-0001 §1) — a
 * grandparent who reads only Korean needs to be able to read every word of
 * this, not a summary.
 *
 * This is an engineering draft of docs/privacy-policy.md, not legally
 * cleared copy — see that file's TODO(Jai) markers for what is still
 * missing (legal entity, retention periods, PIPA contact).
 */
export function PrivacyScreen() {
  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView>
        <View testID="privacy-screen" className="flex-1 gap-6 p-4 pb-12">
          <View className="gap-1">
            <Text className="text-2xl font-bold">Privacy & data</Text>
            <Text className="text-neutral-600 dark:text-neutral-400">
              개인정보 및 데이터
            </Text>
            <Text className="text-xs text-neutral-500">
              {`Last updated ${PRIVACY_POLICY_VERSION} · ${PRIVACY_POLICY_VERSION} 기준`}
            </Text>
          </View>

          <View className="gap-2 rounded-md border border-warning-300 p-3 dark:border-warning-700">
            <Text className="text-sm text-warning-700 dark:text-warning-300">
              This is a draft for review, not final legal advice.
            </Text>
            <Text className="text-sm text-warning-700 dark:text-warning-300">
              이 내용은 검토용 초안이며, 최종 법률 자문이 아니에요.
            </Text>
          </View>

          {PRIVACY_SECTIONS.map(section => (
            <SectionCard key={section.heading_en} section={section} />
          ))}
        </View>
      </ScrollView>
    </>
  );
}

function SectionCard({ section }: { section: PrivacySection }) {
  return (
    <View className="gap-2">
      <Text className="text-lg font-bold">{section.heading_en}</Text>
      <Text className="font-bold text-neutral-600 dark:text-neutral-400">
        {section.heading_ko}
      </Text>
      <Text className="text-neutral-700 dark:text-neutral-300">
        {section.body_en}
      </Text>
      <Text className="text-neutral-500">{section.body_ko}</Text>
    </View>
  );
}
