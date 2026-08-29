import * as React from 'react';

import {
  ActivityIndicator,
  FocusAwareStatusBar,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { PRIVACY_SECTIONS } from '@/features/legal/privacy-content';
import { getMyChild } from '@/lib/supabase/onboarding';

/**
 * The parent-facing privacy/AI-disclosure notice (issue #12), reachable from
 * Settings and from the first-run consent step in child setup.
 *
 * Both languages always render, lead first — the same convention the reader
 * uses for story pages (ADR-0001 §1) — because a document naming which
 * providers see a family's data is exactly the kind of thing a
 * Korean-reading grandparent should be able to read in full too, not a
 * summary.
 */
export function PrivacyScreen() {
  const [lead, setLead] = React.useState<'en' | 'ko'>('en');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        // No child yet (e.g. reached from the consent step before one
        // exists) just means "default to English" — not an error.
        const child = await getMyChild();
        if (child !== null) {
          setLead(child.primary_language);
        }
      }
      catch {
        // Same fallback: a failed lookup should not block reading the notice.
      }
      finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView>
        <View className="flex-1 gap-6 p-4 pb-12">
          <View className="gap-1">
            <Text className="text-2xl font-bold">
              {lead === 'ko' ? '개인정보 처리방침 및 AI 이용 안내' : 'Privacy & how AI is used'}
            </Text>
            <Text className="text-lg text-neutral-500">
              {lead === 'ko' ? 'Privacy & how AI is used' : '개인정보 처리방침 및 AI 이용 안내'}
            </Text>
          </View>
          <View className="gap-1">
            <Text className="text-sm text-neutral-500">
              {lead === 'ko'
                ? '검토용 초안이며, 아직 법률 검토를 거치지 않았습니다.'
                : 'A draft for review — not yet legally cleared.'}
            </Text>
            <Text className="text-sm text-neutral-500">
              {lead === 'ko'
                ? 'A draft for review — not yet legally cleared.'
                : '검토용 초안이며, 아직 법률 검토를 거치지 않았습니다.'}
            </Text>
          </View>

          {PRIVACY_SECTIONS.map(section => (
            <View key={section.id} testID={`privacy-section-${section.id}`} className="gap-2">
              <Text className="text-lg font-bold">
                {lead === 'ko' ? section.heading_ko : section.heading_en}
              </Text>
              <Text className="text-neutral-700 dark:text-neutral-300">
                {lead === 'ko' ? section.body_ko : section.body_en}
              </Text>
              <Text className="pt-1 font-bold text-neutral-500">
                {lead === 'ko' ? section.heading_en : section.heading_ko}
              </Text>
              <Text className="text-neutral-500">
                {lead === 'ko' ? section.body_en : section.body_ko}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}
