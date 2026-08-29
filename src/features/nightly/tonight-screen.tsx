import type { NightlyState } from '@/lib/supabase/nightly';
import type { ChapterQueueJob } from '@/lib/supabase/types';

import { useFocusEffect, useRouter } from 'expo-router';
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
import { LessonPicker } from '@/features/nightly/lesson-picker';
import { useNightly } from '@/features/nightly/use-nightly';

/**
 * The home screen at bedtime.
 *
 * There is exactly one thing to do here and it should take one tap. A chapter
 * that is ready was written last night and is already through the parent gate,
 * so "Read together" opens instantly — which is the entire point of issue #9.
 */
export function TonightScreen() {
  const router = useRouter();
  const nightly = useNightly();
  const { refresh } = nightly;

  // Coming back from the reader, the chapter just read is now read — and the
  // job queued at the end of it is now running. Refetch rather than show stale.
  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // A blocked allowance takes over the whole body — there is nothing else
  // useful to do tonight until next month, so it replaces the picker rather
  // than sitting alongside it.
  let body: React.ReactNode;
  if (nightly.quotaNotice !== null) {
    body = (
      <QuotaNotice
        notice={nightly.quotaNotice}
        lead={nightly.child?.primary_language ?? 'en'}
      />
    );
  }
  else if (nightly.state === null) {
    body = <ActivityIndicator />;
  }
  else {
    body = (
      <Body
        state={nightly.state}
        name={nightly.name}
        busy={nightly.busy}
        savedOffline={nightly.savedOffline}
        onQueue={nightly.queue}
      />
    );
  }

  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView>
        <View className="flex-1 gap-6 p-4 pb-12">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold">Tonight</Text>
            <Pressable onPress={() => router.push('/library')} testID="go-library">
              <Text className="text-primary-600 dark:text-primary-400">
                All chapters
              </Text>
            </Pressable>
          </View>

          {nightly.offline && (
            <View
              testID="offline-banner"
              className="rounded-md border border-neutral-300 p-3 dark:border-neutral-600"
            >
              <Text className="text-neutral-600 dark:text-neutral-400">
                You're offline. Reading what's saved on this device.
              </Text>
            </View>
          )}

          {nightly.error !== null && (
            <View className="rounded-md bg-danger-100 p-3 dark:bg-danger-900">
              <Text className="text-danger-800 dark:text-danger-100">
                {nightly.error}
              </Text>
            </View>
          )}

          {body}
        </View>
      </ScrollView>
    </>
  );
}

function Body({
  state,
  name,
  busy,
  savedOffline,
  onQueue,
}: {
  state: NightlyState;
  name: string;
  busy: boolean;
  savedOffline: boolean;
  onQueue: (lesson: string | undefined, situation: string | undefined) => void;
}) {
  const router = useRouter();

  switch (state.kind) {
    case 'ready':
      return (
        <Ready
          title={state.chapter.title_en ?? ''}
          titleKo={state.chapter.title_ko ?? ''}
          number={state.chapter.number}
          savedOffline={savedOffline}
          onRead={() => router.push(`/read/${state.chapter.id}`)}
        />
      );

    case 'awaiting_review':
      return (
        <Card
          title="Waiting for you"
          body={`${state.title} is written. Have a read before ${name} does — it only takes a minute, and it's the last step before it's theirs.`}
        >
          <Button
            label="Read it first"
            onPress={() => router.push(`/review/${state.chapterId}`)}
            testID="go-review"
          />
        </Card>
      );

    case 'writing':
      return <Writing job={state.job} name={name} />;

    case 'failed':
      return (
        <Card
          title="That one didn't come out"
          body={`We tried a few times and couldn't finish it. Nothing was charged to your allowance. ${state.job.error ?? ''}`}
        >
          <Button
            label="Try again"
            disabled={busy}
            onPress={() => onQueue(state.job.lesson, state.job.situation ?? undefined)}
            testID="retry-job"
          />
        </Card>
      );

    case 'empty':
      return <LessonPicker name={name} busy={busy} onChoose={onQueue} />;

    case 'offline_empty':
      return (
        <Card
          title="No connection, and nothing saved yet"
          body={`Chapters you've already read stay on this device, so they work `
            + `anywhere. This one hasn't been downloaded yet — reconnect for a `
            + `moment and it'll be here for ${name} tonight.`}
        >
          <View />
        </Card>
      );
  }
}

function Ready({
  title,
  titleKo,
  number,
  savedOffline,
  onRead,
}: {
  title: string;
  titleKo: string;
  number: number;
  savedOffline: boolean;
  onRead: () => void;
}) {
  return (
    <View className="gap-4 rounded-xl border border-primary-300 p-5 dark:border-primary-700">
      <Text className="text-xs font-bold tracking-wider text-primary-600 uppercase dark:text-primary-400">
        Tonight's chapter is ready
      </Text>
      <View className="gap-1">
        <Text className="text-2xl font-bold">
          {number}
          .
          {' '}
          {title}
        </Text>
        <Text className="text-lg text-neutral-600 dark:text-neutral-400">
          {titleKo}
        </Text>
      </View>
      <Button label="Read together" onPress={onRead} testID="read-tonight" />
      {savedOffline && (
        <Text testID="saved-offline" className="text-center text-sm text-neutral-500">
          Saved on this device — reads with no signal.
        </Text>
      )}
    </View>
  );
}

function Writing({ job, name }: { job: ChapterQueueJob; name: string }) {
  return (
    <View className="gap-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-700">
      <View className="flex-row items-center gap-3">
        <ActivityIndicator />
        <Text className="font-bold">Writing tomorrow's chapter</Text>
      </View>
      <Text className="text-neutral-600 dark:text-neutral-400">
        It's about
        {' '}
        {job.lesson}
        .
        {job.auto_chosen ? ' We picked that one.' : ''}
        {' '}
        This takes a couple of minutes, and you don't have to wait for it —
        it'll be here for
        {' '}
        {name}
        {' '}
        tomorrow.
      </Text>
    </View>
  );
}

/**
 * A blocked chapter allowance (issue #6) — a per-volume rhythm, not a
 * punishment. Bilingual, both languages always rendered per ADR-0001 §1, the
 * child's own language leading rather than always English.
 */
function QuotaNotice({
  notice,
  lead,
}: {
  notice: { messageEn: string; messageKo: string };
  lead: 'en' | 'ko';
}) {
  const primary = lead === 'ko' ? notice.messageKo : notice.messageEn;
  const secondary = lead === 'ko' ? notice.messageEn : notice.messageKo;
  return (
    <View
      testID="quota-notice"
      className="gap-2 rounded-xl border border-primary-300 p-5 dark:border-primary-700"
    >
      <Text className="text-lg font-bold">{primary}</Text>
      <Text className="text-neutral-500">{secondary}</Text>
    </View>
  );
}

function Card({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-700">
      <Text className="text-xl font-bold">{title}</Text>
      <Text className="text-neutral-600 dark:text-neutral-400">{body}</Text>
      {children}
    </View>
  );
}
