import type { CharacterField } from '@/lib/character/options';

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as React from 'react';

import {
  ActivityIndicator,
  Button,
  FocusAwareStatusBar,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { Chip, ChipRow, Field } from '@/components/ui/choice-chips';
import { useCharacterLook } from '@/features/character/use-character-look';
import { CHARACTER_FIELDS } from '@/lib/character/options';

/**
 * The guided look picker.
 *
 * There is no free-text box here, and that is the design. Spike A found the
 * difference between a character sheet that holds across twenty chapters and
 * one that drifts is entirely in prompt wording nobody would think to type —
 * naming the identity anchors, refusing the anime default, repeating the same
 * sentence verbatim every time. A parent typing "cute girl with brown hair"
 * gets a different child every night. So they choose from options, and the
 * server writes the prompt (`supabase/functions/_shared/character.ts`).
 *
 * What is set here is the LOCKED identity — face, hair, eyes, glasses, skin.
 * Clothing is deliberately not on this screen: wardrobe changes per page, and
 * keeping the two apart is what lets a scene put the child in a swimsuit
 * without the face moving (ADR-0001 §5).
 */
export function CharacterPickerScreen() {
  const router = useRouter();
  const look = useCharacterLook();

  if (look.loading) {
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
          <Header name={look.name} locked={look.locked} />

          {look.sheetUrl !== null && (
            <Sheet uri={look.sheetUrl} name={look.name} />
          )}

          {look.drawing && <Drawing name={look.name} />}

          {look.relockCost !== null && (
            <RelockPrompt
              illustratedPages={look.relockCost}
              onConfirm={() => look.draw(true)}
              onCancel={look.dismissRelock}
            />
          )}

          {look.error !== null && (
            <View
              testID="picker-error"
              className="rounded-md bg-danger-100 p-3 dark:bg-danger-900"
            >
              <Text className="text-danger-800 dark:text-danger-100">
                {look.error}
              </Text>
            </View>
          )}

          {CHARACTER_FIELDS.map(field => (
            <ChoiceField
              key={field.key}
              field={field}
              value={look.choices[field.key]}
              onChange={value => look.choose(field.key, value)}
            />
          ))}

          <Actions
            locked={look.locked}
            drawing={look.drawing}
            complete={look.complete}
            onDraw={() => look.draw(look.locked)}
            onDone={() => router.replace('/')}
          />
        </View>
      </ScrollView>
    </>
  );
}

function Header({ name, locked }: { name: string; locked: boolean }) {
  return (
    <View className="gap-1">
      <Text className="text-2xl font-bold">
        {locked ? `This is ${name}` : `What does ${name} look like?`}
      </Text>
      <Text className="text-neutral-600 dark:text-neutral-400">
        {locked
          ? 'Every picture in every chapter is drawn from this one sheet.'
          : 'We draw one character sheet and every chapter is drawn from it, so '
            + `${name} looks like the same child all the way through.`}
      </Text>
    </View>
  );
}

function ChoiceField({
  field,
  value,
  onChange,
}: {
  field: CharacterField;
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={field.label} hint={field.hint}>
      <ChipRow wrap>
        {field.options.map(option => (
          <Chip
            key={option.value}
            label={option.label}
            selected={value === option.value}
            onPress={() => onChange(option.value)}
            testID={`${field.key}-${option.value}`}
          />
        ))}
      </ChipRow>
    </Field>
  );
}

function Sheet({ uri, name }: { uri: string; name: string }) {
  return (
    <View className="gap-2">
      <Image
        source={{ uri }}
        style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 12 }}
        contentFit="contain"
        transition={200}
        accessibilityLabel={`Character sheet for ${name}`}
      />
      <Text className="text-sm text-neutral-500">
        Three views, so the illustrator has every angle it needs.
      </Text>
    </View>
  );
}

function Drawing({ name }: { name: string }) {
  return (
    <View className="items-center gap-3 rounded-lg border border-neutral-200 p-6 dark:border-neutral-700">
      <ActivityIndicator />
      <Text className="text-neutral-600 dark:text-neutral-400">
        Drawing
        {' '}
        {name}
        … this takes about half a minute.
      </Text>
    </View>
  );
}

/**
 * The one genuinely irreversible thing on this screen. Re-drawing after pages
 * exist leaves a book whose early chapters show a different child, so the count
 * is the message — at zero it is free, at twenty it is not.
 */
function RelockPrompt({
  illustratedPages,
  onConfirm,
  onCancel,
}: {
  illustratedPages: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <View className="gap-3 rounded-md border border-warning-300 p-4 dark:border-warning-700">
      <Text className="font-bold">Replace the character sheet?</Text>
      <Text className="text-neutral-700 dark:text-neutral-300">
        {illustratedPages === 0
          ? 'Nothing has been illustrated yet, so nothing will change except the '
          + 'sheet itself.'
          : `${illustratedPages} page${illustratedPages === 1 ? '' : 's'} `
            + 'have already been drawn from the current sheet. Those pictures stay '
            + 'as they are, so the earlier chapters will no longer match the later '
            + 'ones.'}
      </Text>
      <Button label="Draw a new one" onPress={onConfirm} testID="confirm-relock" />
      <Button
        label="Keep the one we have"
        variant="secondary"
        onPress={onCancel}
        testID="cancel-relock"
      />
    </View>
  );
}

function Actions({
  locked,
  drawing,
  complete,
  onDraw,
  onDone,
}: {
  locked: boolean;
  drawing: boolean;
  complete: boolean;
  onDraw: () => void;
  onDone: () => void;
}) {
  return (
    <View className="gap-3 pt-2">
      <Button
        label={locked ? 'Draw another' : 'Draw them'}
        disabled={drawing || !complete}
        onPress={onDraw}
        testID="draw-sheet"
      />
      {!complete && (
        <Text className="text-center text-sm text-neutral-500">
          Choose an answer for each of the questions above.
        </Text>
      )}
      {locked && (
        <Button
          label="That's them — start their book"
          variant="secondary"
          disabled={drawing}
          onPress={onDone}
          testID="finish-character"
        />
      )}
    </View>
  );
}
