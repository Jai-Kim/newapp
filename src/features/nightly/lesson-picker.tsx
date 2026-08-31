import * as React from 'react';

import { Button, Input, Text, View } from '@/components/ui';
import { Chip, ChipRow, Field } from '@/components/ui/choice-chips';
import { SENSITIVE_TOPIC_DISCLAIMER } from '@/features/legal/sensitive-topic-content';

/**
 * What tomorrow is about.
 *
 * Asked at the END of tonight's read, not at the start of tomorrow's. That
 * ordering is what makes pre-generation possible at all — a chapter whose
 * subject is chosen at the moment it is wanted cannot have been written in
 * advance (issue #9).
 */

type Lead = 'en' | 'ko';

/**
 * Everyday and age-neutral. Mirrors the server's fallback list
 * (`supabase/functions/_shared/lessons.ts`, `FALLBACK_LESSONS`) and is
 * screened against it (`crisis.ts`) to skip a needless model call on the
 * common path.
 *
 * `value` is the WIRE VALUE — it crosses straight through `onChoose` into the
 * generation request and must stay byte-identical to the server's list. `ko`
 * is a display-only label; it is never sent anywhere.
 */
export const LESSONS: { value: string; ko: string }[] = [
  { value: 'trying again after something goes wrong', ko: '실수해도 다시 도전하기' },
  { value: 'sharing something you don\'t want to share', ko: '나누고 싶지 않은 걸 나누기' },
  { value: 'being brave about something new', ko: '새로운 것 앞에서 용기 내기' },
  { value: 'saying sorry and meaning it', ko: '진심으로 미안하다고 말하기' },
  { value: 'noticing when someone else is sad', ko: '다른 사람의 슬픔을 알아차리기' },
  { value: 'waiting for your turn', ko: '차례를 기다리기' },
  { value: 'telling the truth when it\'s hard', ko: '힘들어도 사실대로 말하기' },
  { value: 'asking for help', ko: '도움을 요청하기' },
  { value: 'being kind to someone left out', ko: '소외된 친구에게 다정하게 대하기' },
  { value: 'finishing something you started', ko: '시작한 일을 끝까지 해내기' },
];

/**
 * The ten lesson chips.
 *
 * Each label stacks the parent's lead language above the other on an
 * explicit line break, rather than joining them on one line. A chip has no
 * bounded width, and these are full phrases (up to ~40 characters) that
 * already sit near the edge of a phone's width in English alone — a single
 * `en · ko` line would very likely overflow. Stacking keeps the widest line
 * the same as it is today (unchanged from the English-only original) while
 * still showing both languages, per ADR-0001 §1. The one thing lost is that
 * `Chip` renders its `label` as a single `Text`, so — unlike the two-Text
 * lead/secondary treatment used elsewhere in this app — both lines render at
 * the same weight here; a deliberate, disclosed simplification for a compact
 * tap target, not a silent one.
 */
function LessonChips({
  lead,
  lesson,
  onSelect,
}: {
  lead: Lead;
  lesson: string | null;
  onSelect: (value: string) => void;
}) {
  return (
    <Field
      label={
        lead === 'ko'
          ? '내일 이야기 주제 · Tomorrow\'s lesson'
          : 'Tomorrow\'s lesson · 내일 이야기 주제'
      }
    >
      <ChipRow wrap>
        {LESSONS.map(l => (
          <Chip
            key={l.value}
            label={lead === 'ko' ? `${l.ko}\n${l.value}` : `${l.value}\n${l.ko}`}
            selected={lesson === l.value}
            onPress={() => onSelect(l.value)}
            testID={`lesson-${l.value.slice(0, 12)}`}
          />
        ))}
      </ChipRow>
    </Field>
  );
}

function SituationInput({
  lead,
  name,
  situation,
  onChangeText,
}: {
  lead: Lead;
  name: string;
  situation: string;
  onChangeText: (text: string) => void;
}) {
  const enHelper = `Optional. Gives ${name}'s chapter something real to hold on to.`;
  const koHelper = `선택 사항이에요. ${name}의 이야기에 진짜 있었던 일을 담아 줘요.`;

  return (
    <>
      <Input
        testID="situation"
        label={
          lead === 'ko'
            ? '내일 특별한 일이 있나요? · Anything happening tomorrow?'
            : 'Anything happening tomorrow? · 내일 특별한 일이 있나요?'
        }
        placeholder={lead === 'ko' ? '예: 수영 첫 수업' : 'First swim lesson'}
        value={situation}
        onChangeText={onChangeText}
      />
      <View className="-mt-3 gap-0.5">
        <Text className="text-sm text-neutral-500">
          {lead === 'ko' ? koHelper : enHelper}
        </Text>
        <Text className="text-sm text-neutral-500">
          {lead === 'ko' ? enHelper : koHelper}
        </Text>
      </View>
    </>
  );
}

function LessonPickerActions({
  lead,
  busy,
  disabled,
  onWrite,
  onAuto,
}: {
  lead: Lead;
  busy: boolean;
  disabled: boolean;
  onWrite: () => void;
  onAuto: () => void;
}) {
  const writeLabel = busy
    ? (lead === 'ko' ? '시작하는 중… · Starting…' : 'Starting… · 시작하는 중…')
    : (lead === 'ko'
        ? '내일 이야기 쓰기 · Write tomorrow\'s chapter'
        : 'Write tomorrow\'s chapter · 내일 이야기 쓰기');
  const autoLabel = lead === 'ko'
    ? '저 대신 골라 주세요 · You choose for me'
    : 'You choose for me · 저 대신 골라 주세요';

  return (
    <>
      <Button
        label={writeLabel}
        disabled={disabled}
        onPress={onWrite}
        testID="queue-tomorrow"
      />
      <Button
        label={autoLabel}
        variant="secondary"
        disabled={busy}
        onPress={onAuto}
        testID="queue-auto"
      />
    </>
  );
}

export function LessonPicker({
  name,
  busy,
  lead,
  onChoose,
}: {
  name: string;
  busy: boolean;
  lead: Lead;
  onChoose: (lesson: string | undefined, situation: string | undefined) => void;
}) {
  const [lesson, setLesson] = React.useState<string | null>(null);
  const [situation, setSituation] = React.useState('');

  return (
    <View className="gap-5">
      <View className="gap-1">
        <Text className="text-xl font-bold">
          {lead === 'ko' ? '내일은 어떤 이야기를 들려줄까요?' : 'What should tomorrow be about?'}
        </Text>
        <Text className="text-neutral-600 dark:text-neutral-400">
          {lead === 'ko' ? 'What should tomorrow be about?' : '내일은 어떤 이야기를 들려줄까요?'}
        </Text>
        <Text className="text-neutral-600 dark:text-neutral-400">
          {lead === 'ko'
            ? '오늘 밤 미리 써 둘게요. 내일 자리에 앉는 순간 바로 읽을 수 있어요.'
            : 'We\'ll write it tonight, so it\'s ready the moment you sit down tomorrow.'}
        </Text>
        <Text className="text-neutral-600 dark:text-neutral-400">
          {lead === 'ko'
            ? 'We\'ll write it tonight, so it\'s ready the moment you sit down tomorrow.'
            : '오늘 밤 미리 써 둘게요. 내일 자리에 앉는 순간 바로 읽을 수 있어요.'}
        </Text>
      </View>

      <LessonChips lead={lead} lesson={lesson} onSelect={setLesson} />

      <SituationInput
        lead={lead}
        name={name}
        situation={situation}
        onChangeText={setSituation}
      />

      <Text testID="sensitive-topic-disclaimer" className="text-xs text-neutral-400">
        {SENSITIVE_TOPIC_DISCLAIMER.en}
        {' / '}
        {SENSITIVE_TOPIC_DISCLAIMER.ko}
      </Text>

      <LessonPickerActions
        lead={lead}
        busy={busy}
        disabled={busy || lesson === null}
        onWrite={() => onChoose(lesson ?? undefined, situation.trim() || undefined)}
        onAuto={() => onChoose(undefined, situation.trim() || undefined)}
      />
    </View>
  );
}
