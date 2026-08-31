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
import { AiGeneratedNotice } from '@/features/legal/ai-generated-notice';
import { LessonPicker } from '@/features/nightly/lesson-picker';
import { useChapterReader } from '@/features/reader/use-chapter-reader';

type Lead = 'en' | 'ko';

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
      <ReaderError lead={reader.lead} error={reader.error} onBack={() => router.back()} />
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

/**
 * `error` carries whatever the hook surfaced (usually an English network
 * message from a lower layer) and is shown as-is — only the fallback for "we
 * don't know why, but this chapter won't open" is a string this screen
 * chose, so only that one is bilingual.
 */
function ReaderError({
  lead,
  error,
  onBack,
}: {
  lead: Lead;
  error: string | null;
  onBack: () => void;
}) {
  return (
    <View className="flex-1 gap-4 p-4">
      {error !== null
        ? (
            <Text className="text-danger-600">{error}</Text>
          )
        : (
            <View className="gap-1">
              <Text className="text-danger-600">
                {lead === 'ko' ? '이 챕터를 열 수 없어요.' : 'That chapter could not be opened.'}
              </Text>
              <Text className="text-danger-600">
                {lead === 'ko' ? 'That chapter could not be opened.' : '이 챕터를 열 수 없어요.'}
              </Text>
            </View>
          )}
      <Button
        label={lead === 'ko' ? '뒤로 · Back' : 'Back · 뒤로'}
        onPress={onBack}
        testID="reader-back"
      />
    </View>
  );
}

/**
 * The back/next row. Split out from `Page` so both the dual-language nav
 * labels and the page body can grow without either function tripping the
 * max-lines-per-function lint cap.
 */
function PageNav({
  index,
  total,
  lead,
  onBack,
  onNext,
}: {
  index: number;
  total: number;
  lead: Lead;
  onBack: () => void;
  onNext: () => void;
}) {
  const disabled = index === 0;
  const last = index === total - 1;
  const nextEn = last ? 'The end →' : 'Next →';
  const nextKo = last ? '끝 →' : '다음 →';
  const backLeadClass = disabled
    ? 'text-sm text-neutral-300 dark:text-neutral-700'
    : 'text-sm text-primary-600 dark:text-primary-400';
  const backOffLeadClass = disabled
    ? 'text-xs text-neutral-300 dark:text-neutral-700'
    : 'text-xs text-neutral-400';

  return (
    <View className="flex-row items-center justify-between gap-4 p-4 pb-10">
      <Pressable onPress={onBack} disabled={disabled} testID="prev-page">
        <View>
          <Text className={backLeadClass}>{lead === 'ko' ? '← 뒤로' : '← Back'}</Text>
          <Text className={backOffLeadClass}>{lead === 'ko' ? '← Back' : '← 뒤로'}</Text>
        </View>
      </Pressable>
      <Text className="text-sm text-neutral-500">
        {index + 1}
        {' / '}
        {total}
      </Text>
      <Pressable onPress={onNext} testID="next-page">
        <View>
          <Text className="text-sm text-primary-600 dark:text-primary-400">
            {lead === 'ko' ? nextKo : nextEn}
          </Text>
          <Text className="text-xs text-neutral-400">{lead === 'ko' ? nextEn : nextKo}</Text>
        </View>
      </Pressable>
    </View>
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
  lead: Lead;
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
              <View className="gap-2">
                <Text className="text-2xl font-bold">
                  {lead === 'ko' ? chapter.title_ko : chapter.title_en}
                </Text>
                <Text className="text-lg text-neutral-500">
                  {lead === 'ko' ? chapter.title_en : chapter.title_ko}
                </Text>
                <AiGeneratedNotice lead={lead} reviewed />
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

        <PageNav index={index} total={total} lead={lead} onBack={onBack} onNext={onNext} />
      </ScrollView>
    </>
  );
}

/**
 * Lead title + off-lead title, same standard `Page` holds itself to — and
 * the sign-off travels with whichever title line it follows, since
 * "goodnight" is a language, not a fact.
 */
function TheEndBanner({ chapter, lead }: { chapter: ChildReadableChapter; lead: Lead }) {
  return (
    <View className="gap-1">
      <Text className="text-2xl font-bold">{lead === 'ko' ? '끝' : 'The end'}</Text>
      <Text className="text-lg text-neutral-500">{lead === 'ko' ? 'The end' : '끝'}</Text>
      <Text className="text-neutral-600 dark:text-neutral-400">
        {lead === 'ko'
          ? `${chapter.title_ko} — 안녕히 주무세요.`
          : `${chapter.title_en} — goodnight.`}
      </Text>
      <Text className="text-neutral-500">
        {lead === 'ko'
          ? `${chapter.title_en} — goodnight.`
          : `${chapter.title_ko} — 안녕히 주무세요.`}
      </Text>
    </View>
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
  lead: Lead;
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
          <TheEndBanner chapter={chapter} lead={lead} />

          <LessonPicker name={name} busy={busy} onChoose={onQueue} />

          <Pressable onPress={onSkip} testID="skip-tomorrow">
            <View className="items-center gap-0.5">
              <Text className="text-center text-neutral-500">
                {lead === 'ko' ? '오늘 밤은 건너뛸게요' : 'Not tonight'}
              </Text>
              <Text className="text-center text-xs text-neutral-400">
                {lead === 'ko' ? 'Not tonight' : '오늘 밤은 건너뛸게요'}
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}
