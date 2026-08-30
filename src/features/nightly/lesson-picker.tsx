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

/** Everyday and age-neutral. Mirrors the server's fallback list. */
export const LESSONS = [
  'trying again after something goes wrong',
  'sharing something you don\'t want to share',
  'being brave about something new',
  'saying sorry and meaning it',
  'noticing when someone else is sad',
  'waiting for your turn',
  'telling the truth when it\'s hard',
  'asking for help',
  'being kind to someone left out',
  'finishing something you started',
];

export function LessonPicker({
  name,
  busy,
  onChoose,
}: {
  name: string;
  busy: boolean;
  onChoose: (lesson: string | undefined, situation: string | undefined) => void;
}) {
  const [lesson, setLesson] = React.useState<string | null>(null);
  const [situation, setSituation] = React.useState('');

  return (
    <View className="gap-5">
      <View className="gap-1">
        <Text className="text-xl font-bold">
          What should tomorrow be about?
        </Text>
        <Text className="text-neutral-600 dark:text-neutral-400">
          We'll write it tonight, so it's ready the moment you sit down
          tomorrow.
        </Text>
      </View>

      <Field label="Tomorrow's lesson">
        <ChipRow wrap>
          {LESSONS.map(l => (
            <Chip
              key={l}
              label={l}
              selected={lesson === l}
              onPress={() => setLesson(l)}
              testID={`lesson-${l.slice(0, 12)}`}
            />
          ))}
        </ChipRow>
      </Field>

      <Input
        testID="situation"
        label="Anything happening tomorrow?"
        placeholder="First swim lesson"
        value={situation}
        onChangeText={setSituation}
      />
      <Text className="-mt-3 text-sm text-neutral-500">
        Optional. Gives
        {' '}
        {name}
        's chapter something real to hold on to.
      </Text>
      <Text testID="sensitive-topic-disclaimer" className="text-xs text-neutral-400">
        {SENSITIVE_TOPIC_DISCLAIMER.en}
        {' / '}
        {SENSITIVE_TOPIC_DISCLAIMER.ko}
      </Text>

      <Button
        label={busy ? 'Starting…' : 'Write tomorrow\'s chapter'}
        disabled={busy || lesson === null}
        onPress={() => onChoose(lesson ?? undefined, situation.trim() || undefined)}
        testID="queue-tomorrow"
      />
      <Button
        label="You choose for me"
        variant="secondary"
        disabled={busy}
        onPress={() => onChoose(undefined, situation.trim() || undefined)}
        testID="queue-auto"
      />
    </View>
  );
}
