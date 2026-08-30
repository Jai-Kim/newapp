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
import {
  ONBOARDING_CONSENT_ITEMS,
  PRIVACY_POLICY_VERSION,
} from '@/features/legal/privacy-content';
import { messageOf } from '@/lib/errors';
import { createFamilyAndChild } from '@/lib/supabase/onboarding';

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
  const [consented, setConsented] = React.useState(false);
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
      await createFamilyAndChild(
        {
          first_name: name,
          age_band: ageBand,
          primary_language: language,
          interests,
        },
        { version: PRIVACY_POLICY_VERSION },
      );
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
            checked={consented}
            onChange={setConsented}
            onReadMore={() => router.push('/privacy')}
          />

          {error !== null && (
            <View className="rounded-md bg-danger-100 p-3 dark:bg-danger-900">
              <Text className="text-danger-800 dark:text-danger-100">{error}</Text>
            </View>
          )}

          <Button
            label={busy ? 'Setting up…' : 'Continue'}
            disabled={busy || name.trim().length === 0 || !consented}
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

/**
 * PIPA-shaped consent (issue #12): separate and specific, not a ToS checkbox.
 * Each item is its own line rather than a paragraph, and the cross-border
 * transfer to Anthropic/Google is called out on its own — PIPA requires that
 * one to be disclosed separately from the rest. The full legal text is one
 * tap away, not reproduced here, so this stays a screen a tired parent can
 * actually get through.
 */
function PrivacyConsentField({
  checked,
  onChange,
  onReadMore,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  onReadMore: () => void;
}) {
  return (
    <Field
      label="Before we start"
      hint="시작하기 전에"
    >
      <View className="gap-2 rounded-md border border-neutral-200 p-3 dark:border-neutral-700">
        {ONBOARDING_CONSENT_ITEMS.map(item => (
          <View key={item.en} className="gap-0.5">
            <Text className="text-sm text-neutral-700 dark:text-neutral-300">
              {'• '}
              {item.en}
            </Text>
            <Text className="pl-3 text-sm text-neutral-500">{item.ko}</Text>
          </View>
        ))}

        <Pressable onPress={onReadMore} testID="privacy-read-more">
          <Text className="pt-1 text-sm text-primary-600 dark:text-primary-400">
            Read the full privacy notice / 전체 개인정보 고지 보기
          </Text>
        </Pressable>
      </View>

      <Checkbox
        testID="privacy-consent"
        checked={checked}
        onChange={onChange}
        accessibilityLabel="I understand and agree to how this data is used / 이해했으며 동의합니다"
        label="I understand and agree to how this data is used / 이해했으며 동의합니다"
      />
    </Field>
  );
}
