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
 *
 * This is the first screen a parent ever sees, and the one where they tell us
 * they are Korean-dominant — by tapping a chip, in a language they may not
 * read well yet. So `lead` here is not read from a child (there is none yet)
 * or a cache; it is the `language` state itself, live, the moment the parent
 * taps `한국어`. There is no second source of truth for it.
 */

/** Lead-first `"en · ko"` (or `"ko · en"`), the combined-label convention already used for `Button`/`Field`/`Chip` labels in #41–#43. */
function combine(lead: Language, en: string, ko: string): string {
  return lead === 'ko' ? `${ko} · ${en}` : `${en} · ${ko}`;
}

const AGE_BANDS: { value: AgeBand; label: string }[] = [
  { value: '3-4', label: '3–4' },
  { value: '5-6', label: '5–6' },
  { value: '7-8', label: '7–8' },
];

// The `hint` describes whichever option is currently selected, so it is
// bilingual per-entry rather than combined once — `LanguageField` picks the
// right pair for `value` below. The `label`s ("English" / "한국어") are each
// already in their own language and stay as-is.
const LANGUAGES: { value: Language; label: string; hintEn: string; hintKo: string }[] = [
  {
    value: 'en',
    label: 'English',
    hintEn: 'English reads first, Korean beneath',
    hintKo: '영어가 먼저, 그 아래 한국어가 나와요',
  },
  {
    value: 'ko',
    label: '한국어',
    hintEn: 'Korean reads first, English beneath',
    hintKo: '한국어가 먼저, 그 아래 영어가 나와요',
  },
];

/**
 * Concrete and child-shaped rather than abstract categories — these become
 * story material, so "dinosaurs" is more useful to a storyteller than
 * "animals".
 *
 * `value` is a wire value, exactly like `LESSONS` in
 * `src/features/nightly/lessons.ts`: it goes into `interests` and straight
 * into `createFamilyAndChild` → the storyteller's prompt, and `testID` is
 * derived from it. `ko` is a display-only label shown beside it and must
 * never reach `onToggle`/`interests`. Defined locally rather than imported
 * from `lessons.ts` — different domain, and coupling the two would be worse
 * than the small duplication.
 */
const INTERESTS: { value: string; ko: string }[] = [
  { value: 'animals', ko: '동물' },
  { value: 'dinosaurs', ko: '공룡' },
  { value: 'space', ko: '우주' },
  { value: 'the sea', ko: '바다' },
  { value: 'trains', ko: '기차' },
  { value: 'building things', ko: '만들기' },
  { value: 'drawing', ko: '그림 그리기' },
  { value: 'music', ko: '음악' },
  { value: 'dancing', ko: '춤' },
  { value: 'baking', ko: '빵 굽기' },
  { value: 'gardens', ko: '정원' },
  { value: 'rain', ko: '비' },
  { value: 'bugs', ko: '벌레' },
  { value: 'birds', ko: '새' },
  { value: 'cats', ko: '고양이' },
  { value: 'dogs', ko: '강아지' },
  { value: 'football', ko: '축구' },
  { value: 'swimming', ko: '수영' },
];

function ScreenHeading({ lead }: { lead: Language }) {
  return (
    <View className="gap-1">
      <Text className="text-2xl font-bold">
        {lead === 'ko' ? '누구의 이야기를 들려드릴까요?' : 'Who is the story about?'}
      </Text>
      <Text className="text-neutral-500">
        {lead === 'ko' ? 'Who is the story about?' : '누구의 이야기를 들려드릴까요?'}
      </Text>
      <Text className="text-neutral-600 dark:text-neutral-400">
        {lead === 'ko'
          ? '아이가 모든 챕터의 주인공이에요.'
          : 'Your child is the hero of every chapter.'}
      </Text>
      <Text className="text-neutral-500">
        {lead === 'ko'
          ? 'Your child is the hero of every chapter.'
          : '아이가 모든 챕터의 주인공이에요.'}
      </Text>
    </View>
  );
}

/**
 * The `placeholder` ("Mia") is deliberately left static rather than swapped
 * for a Korean example under `lead === 'ko'`: it is a single arbitrary
 * worked example a parent overwrites within a keystroke or two, not chrome
 * they read — picking one specific Korean example name would read as an
 * assumption about what a Korean-lead family's child is called, which a
 * fixed English example doesn't carry either way.
 */
function NameField({
  lead,
  value,
  onChange,
}: {
  lead: Language;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Input
      testID="child-name"
      label={combine(lead, 'Their first name', '아이의 이름')}
      value={value}
      onChangeText={onChange}
      placeholder="Mia"
    />
  );
}

function AgeField({
  lead,
  value,
  onChange,
}: {
  lead: Language;
  value: AgeBand;
  onChange: (v: AgeBand) => void;
}) {
  return (
    <Field label={combine(lead, 'How old are they?', '나이가 어떻게 되나요?')}>
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

/**
 * `value` doubles as this screen's `lead` here — this is the field that sets
 * it, so there is nothing else to thread in.
 */
function LanguageField({
  value,
  onChange,
}: {
  value: Language;
  onChange: (v: Language) => void;
}) {
  const selected = LANGUAGES.find(l => l.value === value);
  return (
    <Field
      label={combine(value, 'Which language reads first?', '어떤 언어가 먼저 나올까요?')}
      hint={combine(
        value,
        'Every page has both. This just decides which one is on top.',
        '모든 페이지에 두 언어가 다 있어요. 이건 어느 언어가 위에 오는지만 정해요.',
      )}
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
      {selected !== undefined && (
        <>
          <Text className="text-sm text-neutral-500">
            {value === 'ko' ? selected.hintKo : selected.hintEn}
          </Text>
          <Text className="text-xs text-neutral-400">
            {value === 'ko' ? selected.hintEn : selected.hintKo}
          </Text>
        </>
      )}
    </Field>
  );
}

/**
 * Interest tags are two words, not full phrases like `LESSONS`' chips — so
 * unlike `LessonChips` (#43), a combined `en · ko` label on one line reads
 * fine here rather than needing to stack.
 */
function InterestsField({
  lead,
  selected,
  onToggle,
}: {
  lead: Language;
  selected: string[];
  onToggle: (item: string) => void;
}) {
  return (
    <Field
      label={combine(lead, 'What do they love?', '무엇을 좋아하나요?')}
      hint={combine(
        lead,
        'These turn up in their stories. Pick a few.',
        '이야기에 등장할 거예요. 몇 가지 골라주세요.',
      )}
    >
      <ChipRow wrap>
        {INTERESTS.map(i => (
          <Chip
            key={i.value}
            label={combine(lead, i.value, i.ko)}
            selected={selected.includes(i.value)}
            onPress={() => onToggle(i.value)}
            testID={`interest-${i.value}`}
          />
        ))}
      </ChipRow>
    </Field>
  );
}

function ContinueButton({
  lead,
  busy,
  disabled,
  onPress,
}: {
  lead: Language;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      label={busy
        ? combine(lead, 'Setting up…', '설정하는 중…')
        : combine(lead, 'Continue', '계속하기')}
      disabled={disabled}
      onPress={onPress}
      testID="create-child"
    />
  );
}

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
          <ScreenHeading lead={language} />

          <NameField lead={language} value={name} onChange={setName} />

          <AgeField lead={language} value={ageBand} onChange={setAgeBand} />
          <LanguageField value={language} onChange={setLanguage} />
          <InterestsField lead={language} selected={interests} onToggle={toggle} />

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

          <ContinueButton
            lead={language}
            busy={busy}
            disabled={busy || name.trim().length === 0 || !consented}
            onPress={submit}
          />
        </View>
      </ScrollView>
    </>
  );
}

/**
 * PIPA-shaped consent (issue #12): separate and specific, not a ToS checkbox.
 * Each item is its own line rather than a paragraph, and the cross-border
 * transfer to Anthropic/Google is called out on its own — PIPA requires that
 * one to be disclosed separately from the rest. The full legal text is one
 * tap away, not reproduced here, so this stays a screen a tired parent can
 * actually get through.
 *
 * Out of scope for this slice's bilingual pass: already bilingual from #30,
 * and this is PIPA-shaped legal copy — not re-worded, not re-ordered under
 * `lead`, and its `en / ko` slash separator is left as-is rather than
 * "harmonised" with this screen's `·` convention.
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
