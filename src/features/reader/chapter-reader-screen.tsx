import type { ChildReadableChapter } from '@/lib/supabase/types';

import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';

import {
  ActivityIndicator,
  Button,
  FocusAwareStatusBar,
  Pressable,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { AiGeneratedBadge } from '@/features/legal/ai-generated-badge';
import { LessonPicker } from '@/features/nightly/lesson-picker';
import { useChapterReader } from '@/features/reader/use-chapter-reader';

/**
 * Reading together, one page at a time.
 *
 * Page-at-a-time rather than a scroll, for two reasons. It matches how a
 * picture book actually works when a child is following along — one spread,
 * one turn — and it gives the chapter an END, which a scroll view does not.
 * That ending is where the loop closes: the chapter is marked read, and the
 * parent chooses what tomorrow is about while they are still sitting there
 * (issue #9).
 *
 * Both languages are always on the page (ADR-0001 §1). The child's
 * primary_language decides which leads, so a Korean-first family reads Korean
 * at full size with English beneath, and an English-first family gets the
 * reverse — same page, same book, either grandparent can read it.
 */
export function ChapterReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const reader = useChapterReader(id);

  if (reader.loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (reader.error !== null || !reader.chapter) {
    return (
      <View className="flex-1 gap-4 p-4">
        <Text className="text-danger-600">
          {reader.error ?? 'That chapter could not be opened.'}
        </Text>
        <Button label="Back" onPress={() => router.back()} testID="reader-back" />
      </View>
    );
  }

  if (reader.finished) {
    return (
      <TheEnd
        chapter={reader.chapter}
        lead={reader.lead}
        name={reader.name}
        busy={reader.busy}
        onQueue={async (lesson, situation) => {
          await reader.queueTomorrow(lesson, situation);
          router.replace('/');
        }}
        onSkip={() => router.replace('/')}
      />
    );
  }

  return (
    <Page
      chapter={reader.chapter}
      index={reader.index}
      lead={reader.lead}
      imageUrl={reader.imageUrlFor(reader.index)}
      onBack={reader.previous}
      onNext={reader.next}
    />
  );
}

function Page({
  chapter,
  index,
  lead,
  imageUrl,
  onBack,
  onNext,
}: {
  chapter: ChildReadableChapter;
  index: number;
  lead: 'en' | 'ko';
  imageUrl: string | undefined;
  onBack: () => void;
  onNext: () => void;
}) {
  const page = chapter.pages[index];
  const total = chapter.pages.length;

  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView>
        {/* The whole page advances, so a child can tap anywhere. */}
        <Pressable onPress={onNext} testID={`page-${page.page}`}>
          <View className="flex-1 gap-5 p-4 pb-10">
            {index === 0 && (
              <View className="gap-1">
                <Text className="text-2xl font-bold">
                  {lead === 'ko' ? chapter.title_ko : chapter.title_en}
                </Text>
                <Text className="text-lg text-neutral-500">
                  {lead === 'ko' ? chapter.title_en : chapter.title_ko}
                </Text>
                {/* Unobtrusive, once per chapter rather than once per page (issue #12). */}
                <AiGeneratedBadge lead={lead} />
              </View>
            )}

            {imageUrl !== undefined && (
              <Image
                source={{ uri: imageUrl }}
                style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 12 }}
                contentFit="cover"
                transition={200}
              />
            )}

            <Text className="text-2xl/10">
              {lead === 'ko' ? page.ko : page.en}
            </Text>
            <Text className="text-lg/8 text-neutral-600 dark:text-neutral-400">
              {lead === 'ko' ? page.en : page.ko}
            </Text>
          </View>
        </Pressable>

        <View className="flex-row items-center justify-between gap-4 p-4 pb-10">
          <Pressable onPress={onBack} disabled={index === 0} testID="prev-page">
            <Text
              className={
                index === 0
                  ? 'text-neutral-300 dark:text-neutral-700'
                  : 'text-primary-600 dark:text-primary-400'
              }
            >
              ← Back
            </Text>
          </Pressable>
          <Text className="text-sm text-neutral-500">
            {index + 1}
            {' / '}
            {total}
          </Text>
          <Pressable onPress={onNext} testID="next-page">
            <Text className="text-primary-600 dark:text-primary-400">
              {index === total - 1 ? 'The end →' : 'Next →'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

function TheEnd({
  chapter,
  lead,
  name,
  busy,
  onQueue,
  onSkip,
}: {
  chapter: ChildReadableChapter;
  lead: 'en' | 'ko';
  name: string;
  busy: boolean;
  onQueue: (lesson: string | undefined, situation: string | undefined) => void;
  onSkip: () => void;
}) {
  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView>
        <View className="flex-1 gap-6 p-4 pb-12">
          <View className="gap-1">
            <Text className="text-2xl font-bold">
              {lead === 'ko' ? '끝' : 'The end'}
            </Text>
            <Text className="text-neutral-600 dark:text-neutral-400">
              {lead === 'ko' ? chapter.title_ko : chapter.title_en}
              {' — '}
              goodnight.
            </Text>
          </View>

          <LessonPicker name={name} busy={busy} onChoose={onQueue} />

          <Pressable onPress={onSkip} testID="skip-tomorrow">
            <Text className="text-center text-neutral-500">
              Not tonight
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}
