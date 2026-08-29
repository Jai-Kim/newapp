import { Stack } from 'expo-router';
import * as React from 'react';
import {
  ActivityIndicator,
  FocusAwareStatusBar,
  ScrollView,
  Text,
  View,
} from '@/components/ui';

import {
  DPO_CONTACT_PLACEHOLDER,
  LEGAL_ENTITY_NAME_PLACEHOLDER,
  PRIVACY_NOTICE_VERSION,
  PRIVACY_SECTIONS,
} from '@/features/legal/privacy-content';
import { listChildren } from '@/lib/supabase/chapters';

/**
 * Reachable from Settings ("Privacy & Data") at any time, and shown as part
 * of the consent step in child setup. Both languages always render — the
 * child's `primary_language` (if a child exists yet) decides which leads,
 * same convention as the reader (ADR-0001 §1). No parent-preview or safety
 * gate applies here; this screen never reads chapter content.
 */
export function PrivacyScreen() {
  const [lead, setLead] = React.useState<'en' | 'ko'>('en');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const kids = await listChildren();
        if (kids.length > 0) {
          setLead(kids[0].primary_language);
        }
      }
      catch {
        // No child yet, or offline — the notice still reads fine in English.
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
      <Stack.Screen options={{ title: 'Privacy & Data' }} />
      <FocusAwareStatusBar />
      <ScrollView>
        <View testID="privacy-screen" className="flex-1 gap-6 p-4 pb-12">
          <View className="gap-1">
            <Text className="text-2xl font-bold">
              {lead === 'ko' ? '개인정보 및 AI 이용 안내' : 'Privacy & AI use'}
            </Text>
            <Text className="text-neutral-500">
              {lead === 'ko' ? 'Privacy & AI use' : '개인정보 및 AI 이용 안내'}
            </Text>
            <Text className="pt-2 text-xs text-neutral-400">
              {`Version ${PRIVACY_NOTICE_VERSION} · ${LEGAL_ENTITY_NAME_PLACEHOLDER} · ${DPO_CONTACT_PLACEHOLDER}`}
            </Text>
          </View>

          {PRIVACY_SECTIONS.map(section => (
            <Section key={section.id} section={section} lead={lead} />
          ))}
        </View>
      </ScrollView>
    </>
  );
}

function Section({
  section,
  lead,
}: {
  section: (typeof PRIVACY_SECTIONS)[number];
  lead: 'en' | 'ko';
}) {
  const title = lead === 'ko' ? section.title_ko : section.title_en;
  const titleOther = lead === 'ko' ? section.title_en : section.title_ko;
  const body = lead === 'ko' ? section.body_ko : section.body_en;
  const bodyOther = lead === 'ko' ? section.body_en : section.body_ko;

  return (
    <View testID={`privacy-section-${section.id}`} className="gap-2">
      <View className="gap-0.5">
        <Text className="text-lg font-bold">{title}</Text>
        <Text className="text-sm text-neutral-500">{titleOther}</Text>
      </View>
      <Text className="text-neutral-700 dark:text-neutral-300">{body}</Text>
      <Text className="text-sm text-neutral-500">{bodyOther}</Text>
    </View>
  );
}
