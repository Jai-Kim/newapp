import type { AgeBand, Language } from '@/lib/supabase/types';
import { useRouter } from 'expo-router';

import * as React from 'react';
import {
  Button,
  Checkbox,
  FocusAwareStatusBar,
  Input,
  Pressable,
  ScrollView,
  Text,
  View,
} from '@/components/ui';

import { Chip, ChipRow, Field } from '@/components/ui/choice-chips';
import { PRIVACY_POLICY_VERSION } from '@/features/legal/privacy-content';
import { messageOf } from '@/lib/errors';
import { createFamilyAndChild } from '@/lib/supabase/onboarding';
import { recordPrivacyConsent } from '@/lib/supabase/privacy';

/**
 * The first thing a signed-in parent does: tell us who the story is about.
 *
 * Everything here feeds generation directly — `age_band` sets the reading
 * level, `primary_language` decides which language leads on the page
 * (ADR-0001 §3), and `interests` seed the world the storyteller builds. The
 * character *look* is deliberately not here; it is a guided picker of its own
 * of its own, because a parent cannot write a good character prompt.
 */

const AGE_BANDS: { value: AgeBand; label: string }[] = [
  { value: '3-4', label: '3–4' },
  { value: '5-6', label: '5–6' },
  { value: '7-8', label: '7–8' },
];

const LANGUAGES: { value: Language; label: string; hint: string }[] = [
  { value: 'en', label: 'English', hint: 'English reads first, Korean beneath' },
  { value: 'ko', label: '한국어', hint: 'Korean reads first, English beneath' },
];

// Concrete and child-shaped rather than abstract categories — these become
// story material, so "dinosaurs" is more useful to a storyteller than "animals".
const INTERESTS = [
  'animals',
  'dinosaurs',
  'space',
  'the sea',
  'trains',
  'building things',
  'drawing',
  'music',
  'dancing',
  'baking',
  'gardens',
  'rain',
  'bugs',
  'birds',
  'cats',
  'dogs',
  'football',
  'swimming',
];

export function ChildSetupScreen() {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [ageBand, setAgeBand] = React.useState<AgeBand>('5-6');
  const [language, setLanguage] = React.useState<Language>('en');
  const [interests, setInterests] = React.useState<string[]>([]);
  const [consent, setConsent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const toggle = (item: string) =>
    setInterests(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item],
    );

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const child = await createFamilyAndChild({
        first_name: name,
        age_band: ageBand,
        primary_language: language,
        interests,
      });
      // Recorded after the child exists, not before: it is consent to the
      // account generating stories at all, and the family_id it is scoped to
      // doesn't exist until this point (issue #12).
      await recordPrivacyConsent(child.family_id, PRIVACY_POLICY_VERSION);
      // Straight on to the look picker: a child with no character sheet cannot
      // be illustrated at all, so this is one flow, not two optional screens.
      router.replace('/character-setup');
    }
    catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  };

  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView>
        <View className="flex-1 gap-6 p-4 pb-12">
          <View className="gap-1">
            <Text className="text-2xl font-bold">Who is the story about?</Text>
            <Text className="text-neutral-600 dark:text-neutral-400">
              Your child is the hero of every chapter.
            </Text>
          </View>

          <Input
            testID="child-name"
            label="Their first name"
            value={name}
            onChangeText={setName}
            placeholder="Mia"
          />

          <AgeField value={ageBand} onChange={setAgeBand} />
          <LanguageField value={language} onChange={setLanguage} />
          <InterestsField selected={interests} onToggle={toggle} />

          <PrivacyConsentField
            checked={consent}
            onChange={setConsent}
            onReadNotice={() => router.push('/privacy')}
          />

          {error !== null && (
            <View className="rounded-md bg-danger-100 p-3 dark:bg-danger-900">
              <Text className="text-danger-800 dark:text-danger-100">{error}</Text>
            </View>
          )}

          <Button
            label={busy ? 'Setting up…' : 'Continue'}
            disabled={busy || name.trim().length === 0 || !consent}
            onPress={submit}
            testID="create-child"
          />
        </View>
      </ScrollView>
    </>
  );
}

function AgeField({
  value,
  onChange,
}: {
  value: AgeBand;
  onChange: (v: AgeBand) => void;
}) {
  return (
    <Field label="How old are they?">
      <ChipRow>
        {AGE_BANDS.map(b => (
          <Chip
            key={b.value}
            label={b.label}
            selected={value === b.value}
            onPress={() => onChange(b.value)}
            testID={`age-${b.value}`}
          />
        ))}
      </ChipRow>
    </Field>
  );
}

function LanguageField({
  value,
  onChange,
}: {
  value: Language;
  onChange: (v: Language) => void;
}) {
  return (
    <Field
      label="Which language reads first?"
      hint="Every page has both. This just decides which one is on top."
    >
      <ChipRow>
        {LANGUAGES.map(l => (
          <Chip
            key={l.value}
            label={l.label}
            selected={value === l.value}
            onPress={() => onChange(l.value)}
            testID={`lang-${l.value}`}
          />
        ))}
      </ChipRow>
      <Text className="text-sm text-neutral-500">
        {LANGUAGES.find(l => l.value === value)?.hint}
      </Text>
    </Field>
  );
}

/**
 * Explicit parental consent to the privacy/AI-disclosure notice (issue #12),
 * recorded once the child is created (see `submit` above). One screen, warm
 * copy, an un-skippable checkbox — not a legal wall a tired parent has to
 * fight through at bedtime. The full notice is one tap away for anyone who
 * wants to read more.
 */
function PrivacyConsentField({
  checked,
  onChange,
  onReadNotice,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  onReadNotice: () => void;
}) {
  return (
    <Field label="Before we begin">
      <View className="gap-2">
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          Story prompts and generated chapters are sent to Anthropic and
          Google to write and illustrate your child’s stories, and stored
          securely. You review and approve every chapter before your child
          sees it.
        </Text>
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          이야기 프롬프트와 생성된 챕터는 Anthropic과 Google로 전송되어 아이의
          이야기를 쓰고 그림을 그리며, 안전하게 저장됩니다. 아이가 보기 전에
          보호자가 모든 챕터를 검토하고 승인합니다.
        </Text>
        <Pressable onPress={onReadNotice} testID="read-privacy-notice">
          <Text className="text-sm text-primary-600 dark:text-primary-400">
            Read the full privacy notice / 전체 개인정보 처리방침 보기
          </Text>
        </Pressable>
        <Checkbox
          testID="privacy-consent"
          checked={checked}
          onChange={onChange}
          accessibilityLabel="I understand and agree"
          label="I understand and agree. / 이해했으며 동의합니다."
        />
      </View>
    </Field>
  );
}

function InterestsField({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (item: string) => void;
}) {
  return (
    <Field
      label="What do they love?"
      hint="These turn up in their stories. Pick a few."
    >
      <ChipRow wrap>
        {INTERESTS.map(i => (
          <Chip
            key={i}
            label={i}
            selected={selected.includes(i)}
            onPress={() => onToggle(i)}
            testID={`interest-${i}`}
          />
        ))}
      </ChipRow>
    </Field>
  );
}
