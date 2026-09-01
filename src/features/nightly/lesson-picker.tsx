import * as React from 'react';

import { Button, Input, Text, View } from '@/components/ui';
import { Chip, ChipRow, Field } from '@/components/ui/choice-chips';
import { SENSITIVE_TOPIC_DISCLAIMER } from '@/features/legal/sensitive-topic-content';
import { LESSONS } from './lessons';

type Lead = 'en' | 'ko';

/**
 * What tomorrow is about.
 *
 * Asked at the END of tonight's read, not at the start of tomorrow's. That
 * ordering is what makes pre-generation possible at all — a chapter whose
 * subject is chosen at the moment it is wanted cannot have been written in
 * advance (issue #9).
 *
 * Both languages are always on the screen (ADR-0001 §1) — `lead` only
 * decides emphasis and reading order, never which language appears at all.
 * This is the last screen before a parent commits to tomorrow, and it
 * renders inside `TheEnd` every single night, so it does not get to be the
 * one English-only surface.
 */

/** Lead-first `"en · ko"` (or `"ko · en"`), the combined-label convention already used for `Button`/`Field` labels in #41/#42. */
function combine(lead: Lead, en: string, ko: string): string {
  return lead === 'ko' ? `${ko} · ${en}` : `${en} · ${ko}`;
}

/**
 * The ten lesson chips.
 *
 * `Chip` renders `label` as a single `Text` with one style, so unlike the
 * lead/off-lead pairs elsewhere on this screen, a chip can't emphasize one
 * language over the other without adding children to a shared primitive —
 * out of scope here. A combined `en · ko` label would also make several of
 * these ten full phrases uncomfortably wide for a tap target, so each label
 * instead stacks lead-first on its own line within the one `Text`.
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
    <Field label={combine(lead, 'Tomorrow\'s lesson', '내일 이야기의 주제')}>
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

/**
 * The optional situation field. `{name}'s chapter` doesn't translate
 * structurally — the English possessive has no Korean equivalent to bolt a
 * name onto — so the Korean hint is written as its own sentence rather than
 * built by concatenating around `name`.
 */
function SituationField({
  lead,
  name,
  situation,
  onChange,
}: {
  lead: Lead;
  name: string;
  situation: string;
  onChange: (text: string) => void;
}) {
  return (
    <View className="gap-1">
      <Input
        testID="situation"
        label={combine(lead, 'Anything happening tomorrow?', '내일 무슨 일 있나요?')}
        placeholder={combine(lead, 'First swim lesson', '예: 첫 수영 수업')}
        value={situation}
        onChangeText={onChange}
      />
      <Text className="-mt-3 text-sm text-neutral-500">
        {lead === 'ko'
          ? `선택이에요. ${name}의 이야기에 진짜 있었던 일을 살짝 담아 드려요.`
          : `Optional. Gives ${name}'s chapter something real to hold on to.`}
      </Text>
      <Text className="text-xs text-neutral-400">
        {lead === 'ko'
          ? `Optional. Gives ${name}'s chapter something real to hold on to.`
          : `선택이에요. ${name}의 이야기에 진짜 있었던 일을 살짝 담아 드려요.`}
      </Text>
    </View>
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
  return (
    <>
      <Button
        label={busy
          ? combine(lead, 'Starting…', '시작할게요…')
          : combine(lead, 'Write tomorrow\'s chapter', '내일 이야기 쓰기')}
        disabled={disabled}
        onPress={onWrite}
        testID="queue-tomorrow"
      />
      <Button
        label={combine(lead, 'You choose for me', '저 대신 골라 주세요')}
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
        <Text className="text-lg text-neutral-500">
          {lead === 'ko' ? 'What should tomorrow be about?' : '내일은 어떤 이야기를 들려줄까요?'}
        </Text>
        <Text className="text-neutral-600 dark:text-neutral-400">
          {lead === 'ko'
            ? '오늘 밤 미리 써 둘게요. 내일 앉자마자 바로 읽을 수 있어요.'
            : 'We\'ll write it tonight, so it\'s ready the moment you sit down tomorrow.'}
        </Text>
        <Text className="text-neutral-500">
          {lead === 'ko'
            ? 'We\'ll write it tonight, so it\'s ready the moment you sit down tomorrow.'
            : '오늘 밤 미리 써 둘게요. 내일 앉자마자 바로 읽을 수 있어요.'}
        </Text>
      </View>

      <LessonChips lead={lead} lesson={lesson} onSelect={setLesson} />

      <SituationField lead={lead} name={name} situation={situation} onChange={setSituation} />

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
