import type { CrisisNotice as CrisisNoticeData } from '@/features/nightly/use-nightly';
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

type Lead = 'en' | 'ko';

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
  const lead: Lead = nightly.child?.primary_language ?? 'en';

  // Coming back from the reader, the chapter just read is now read — and the
  // job queued at the end of it is now running. Refetch rather than show stale.
  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // A crisis notice takes priority over a quota notice — a crisis-screened
  // request never reached the quota check (issue #13), and there is nothing
  // else useful to do tonight either way, so either replaces the picker
  // rather than sitting alongside it.
  let body: React.ReactNode;
  if (nightly.crisisNotice !== null) {
    body = <CrisisNotice notice={nightly.crisisNotice} lead={lead} />;
  }
  else if (nightly.quotaNotice !== null) {
    body = <QuotaNotice notice={nightly.quotaNotice} lead={lead} />;
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
        lead={lead}
        onQueue={nightly.queue}
      />
    );
  }

  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView>
        <View className="flex-1 gap-6 p-4 pb-12">
          <ScreenHeader lead={lead} onLibrary={() => router.push('/library')} />

          {nightly.offline && <OfflineBanner lead={lead} />}

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

function ScreenHeader({ lead, onLibrary }: { lead: Lead; onLibrary: () => void }) {
  const headingEn = 'Tonight';
  const headingKo = '오늘 밤';
  const linkEn = 'All chapters';
  const linkKo = '전체 챕터';

  return (
    <View className="flex-row items-center justify-between">
      <View className="gap-0.5">
        <Text className="text-2xl font-bold">
          {lead === 'ko' ? headingKo : headingEn}
        </Text>
        <Text className="text-sm text-neutral-500">
          {lead === 'ko' ? headingEn : headingKo}
        </Text>
      </View>
      <Pressable onPress={onLibrary} testID="go-library">
        <View className="items-end gap-0.5">
          <Text className="text-primary-600 dark:text-primary-400">
            {lead === 'ko' ? linkKo : linkEn}
          </Text>
          <Text className="text-xs text-primary-600/70 dark:text-primary-400/70">
            {lead === 'ko' ? linkEn : linkKo}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

function OfflineBanner({ lead }: { lead: Lead }) {
  const en = 'You\'re offline. Reading what\'s saved on this device.';
  const ko = '오프라인이에요. 기기에 저장된 내용을 보여드려요.';

  return (
    <View
      testID="offline-banner"
      className="gap-1 rounded-md border border-neutral-300 p-3 dark:border-neutral-600"
    >
      <Text className="text-neutral-600 dark:text-neutral-400">
        {lead === 'ko' ? ko : en}
      </Text>
      <Text className="text-neutral-500">{lead === 'ko' ? en : ko}</Text>
    </View>
  );
}

function Body({
  state,
  name,
  busy,
  savedOffline,
  lead,
  onQueue,
}: {
  state: NightlyState;
  name: string;
  busy: boolean;
  savedOffline: boolean;
  lead: Lead;
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
          lead={lead}
          onRead={() => router.push(`/read/${state.chapter.id}`)}
        />
      );

    case 'awaiting_review':
      return (
        <AwaitingReview
          title={state.title}
          name={name}
          lead={lead}
          onReview={() => router.push(`/review/${state.chapterId}`)}
        />
      );

    case 'writing':
      return <Writing job={state.job} name={name} lead={lead} />;

    case 'failed':
      return (
        <Failed
          job={state.job}
          busy={busy}
          lead={lead}
          onRetry={() => onQueue(state.job.lesson, state.job.situation ?? undefined)}
        />
      );

    case 'empty':
      return <LessonPicker name={name} busy={busy} lead={lead} onChoose={onQueue} />;

    case 'offline_empty':
      return <OfflineEmpty name={name} lead={lead} />;
  }
}

function Ready({
  title,
  titleKo,
  number,
  savedOffline,
  lead,
  onRead,
}: {
  title: string;
  titleKo: string;
  number: number;
  savedOffline: boolean;
  lead: Lead;
  onRead: () => void;
}) {
  const eyebrowEn = 'Tonight\'s chapter is ready';
  const eyebrowKo = '오늘 밤 챕터가 준비됐어요';
  const readLabel = lead === 'ko'
    ? '함께 읽기 · Read together'
    : 'Read together · 함께 읽기';
  const savedEn = 'Saved on this device — reads with no signal.';
  const savedKo = '기기에 저장되어 있어요 — 신호 없이도 읽을 수 있어요.';

  return (
    <View className="gap-4 rounded-xl border border-primary-300 p-5 dark:border-primary-700">
      <View className="gap-0.5">
        <Text className="text-xs font-bold tracking-wider text-primary-600 uppercase dark:text-primary-400">
          {lead === 'ko' ? eyebrowKo : eyebrowEn}
        </Text>
        <Text className="text-xs text-primary-600/70 dark:text-primary-400/70">
          {lead === 'ko' ? eyebrowEn : eyebrowKo}
        </Text>
      </View>
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
      <Button label={readLabel} onPress={onRead} testID="read-tonight" />
      {savedOffline && (
        <View testID="saved-offline" className="gap-0.5">
          <Text className="text-center text-sm text-neutral-500">
            {lead === 'ko' ? savedKo : savedEn}
          </Text>
          <Text className="text-center text-xs text-neutral-400">
            {lead === 'ko' ? savedEn : savedKo}
          </Text>
        </View>
      )}
    </View>
  );
}

function AwaitingReview({
  title,
  name,
  lead,
  onReview,
}: {
  title: string;
  name: string;
  lead: Lead;
  onReview: () => void;
}) {
  const reviewLabel = lead === 'ko'
    ? '먼저 읽어보기 · Read it first'
    : 'Read it first · 먼저 읽어보기';

  return (
    <Card
      lead={lead}
      title={{ en: 'Waiting for you', ko: '확인을 기다리고 있어요' }}
      body={{
        en: `${title} is written. Have a read before ${name} does — it only `
          + `takes a minute, and it's the last step before it's theirs.`,
        ko: `"${title}" 챕터가 다 쓰였어요. ${name}보다 먼저 한번 읽어 주세요 — `
          + `1분이면 충분하고, ${name}에게 전해지기 전 마지막 단계예요.`,
      }}
    >
      <Button label={reviewLabel} onPress={onReview} testID="go-review" />
    </Card>
  );
}

/**
 * `job.lesson` is a wire value mirroring the server's `FALLBACK_LESSONS`
 * (issue #22, follow-up to #43) — shown once, verbatim, inside a bilingual
 * label rather than translated or table-mapped. Looking it up in
 * `lessons.ts` would risk a silent miss: a parent's own `situation` can also
 * produce a `lesson`, not only the server's fallback list.
 */
function Writing({ job, name, lead }: { job: ChapterQueueJob; name: string; lead: Lead }) {
  const headingEn = 'Writing tomorrow\'s chapter';
  const headingKo = '내일 챕터를 쓰고 있어요';
  const lessonLine = lead === 'ko'
    ? `오늘 밤 이야기 · Tonight's story — "${job.lesson}"`
    : `Tonight's story · 오늘 밤 이야기 — "${job.lesson}"`;
  const autoEn = 'We picked that one.';
  const autoKo = '저희가 대신 골랐어요.';
  const waitEn = `This takes a couple of minutes, and you don't have to wait `
    + `for it — it'll be here for ${name} tomorrow.`;
  const waitKo = `몇 분이면 완성되고, 기다리지 않아도 괜찮아요 — 내일 ${name}을(를) `
    + `위해 준비되어 있을 거예요.`;

  return (
    <View className="gap-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-700">
      <View className="flex-row items-center gap-3">
        <ActivityIndicator />
        <View className="gap-0.5">
          <Text className="font-bold">{lead === 'ko' ? headingKo : headingEn}</Text>
          <Text className="text-sm text-neutral-500">
            {lead === 'ko' ? headingEn : headingKo}
          </Text>
        </View>
      </View>
      <View className="gap-1">
        <Text className="text-neutral-600 dark:text-neutral-400">{lessonLine}</Text>
        {job.auto_chosen && (
          <Text className="text-sm text-neutral-500">
            {lead === 'ko' ? `${autoKo} · ${autoEn}` : `${autoEn} · ${autoKo}`}
          </Text>
        )}
        <Text className="text-neutral-600 dark:text-neutral-400">
          {lead === 'ko' ? waitKo : waitEn}
        </Text>
        <Text className="text-neutral-500">{lead === 'ko' ? waitEn : waitKo}</Text>
      </View>
    </View>
  );
}

/**
 * `job.error` comes straight from the server — out of scope here, same
 * reasoning as `c.issue` in #44's `SafetyNotes`. Shown once, after the
 * bilingual explanation, never translated.
 */
function Failed({
  job,
  busy,
  lead,
  onRetry,
}: {
  job: ChapterQueueJob;
  busy: boolean;
  lead: Lead;
  onRetry: () => void;
}) {
  const retryLabel = lead === 'ko' ? '다시 시도 · Try again' : 'Try again · 다시 시도';

  return (
    <Card
      lead={lead}
      title={{ en: 'That one didn\'t come out', ko: '이번엔 완성되지 못했어요' }}
      body={{
        en: 'We tried a few times and couldn\'t finish it. Nothing was '
          + 'charged to your allowance.',
        ko: '몇 번 시도했지만 완성하지 못했어요. 이용 한도에서 차감되지 않았어요.',
      }}
    >
      {job.error !== null && (
        <Text className="text-sm text-neutral-500">{job.error}</Text>
      )}
      <Button label={retryLabel} disabled={busy} onPress={onRetry} testID="retry-job" />
    </Card>
  );
}

function OfflineEmpty({ name, lead }: { name: string; lead: Lead }) {
  return (
    <Card
      lead={lead}
      title={{
        en: 'No connection, and nothing saved yet',
        ko: '연결이 없고 저장된 것도 없어요',
      }}
      body={{
        en: `Chapters you've already read stay on this device, so they work `
          + `anywhere. This one hasn't been downloaded yet — reconnect for a `
          + `moment and it'll be here for ${name} tonight.`,
        ko: `이미 읽은 챕터는 기기에 저장되어 있어서 어디서든 볼 수 있어요. 이 `
          + `챕터는 아직 다운로드되지 않았어요 — 잠시 연결하면 오늘 밤 ${name}을(를) `
          + `위해 준비될 거예요.`,
      }}
    >
      <View />
    </Card>
  );
}

/**
 * A crisis-screened request (issue #13) — the parent's words weren't turned
 * into a story, and here is who to talk to instead. Bilingual, both
 * languages always rendered per ADR-0001 §1, and never the generic red error
 * box: this is a warm, deliberate hand-off, not a failure state.
 */
function CrisisNotice({
  notice,
  lead,
}: {
  notice: CrisisNoticeData;
  lead: 'en' | 'ko';
}) {
  const primary = lead === 'ko' ? notice.messageKo : notice.messageEn;
  const secondary = lead === 'ko' ? notice.messageEn : notice.messageKo;
  const disclaimerPrimary = lead === 'ko' ? notice.disclaimerKo : notice.disclaimerEn;
  const disclaimerSecondary = lead === 'ko' ? notice.disclaimerEn : notice.disclaimerKo;

  return (
    <View
      testID="crisis-notice"
      className="gap-4 rounded-xl border border-primary-300 p-5 dark:border-primary-700"
    >
      <View className="gap-2">
        <Text className="text-lg font-bold">{primary}</Text>
        <Text className="text-neutral-500">{secondary}</Text>
      </View>

      <View className="gap-3">
        {notice.resources.map(resource => (
          <View key={resource.contact} className="gap-0.5">
            <Text className="font-bold">
              {lead === 'ko' ? resource.nameKo : resource.nameEn}
              {' — '}
              {resource.contact}
            </Text>
            <Text className="text-sm text-neutral-500">
              {lead === 'ko' ? resource.nameEn : resource.nameKo}
            </Text>
            <Text className="text-sm text-neutral-500">
              {lead === 'ko' ? resource.noteKo : resource.noteEn}
            </Text>
            <Text className="text-sm text-neutral-500">
              {lead === 'ko' ? resource.noteEn : resource.noteKo}
            </Text>
          </View>
        ))}
      </View>

      {disclaimerPrimary !== '' && (
        <View className="gap-0.5">
          <Text className="text-xs text-neutral-400">{disclaimerPrimary}</Text>
          <Text className="text-xs text-neutral-400">{disclaimerSecondary}</Text>
        </View>
      )}
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
  lead,
  title,
  body,
  children,
}: {
  lead: Lead;
  title: { en: string; ko: string };
  body: { en: string; ko: string };
  children: React.ReactNode;
}) {
  const titlePrimary = lead === 'ko' ? title.ko : title.en;
  const titleSecondary = lead === 'ko' ? title.en : title.ko;
  const bodyPrimary = lead === 'ko' ? body.ko : body.en;
  const bodySecondary = lead === 'ko' ? body.en : body.ko;

  return (
    <View className="gap-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-700">
      <View className="gap-0.5">
        <Text className="text-xl font-bold">{titlePrimary}</Text>
        <Text className="text-base text-neutral-500">{titleSecondary}</Text>
      </View>
      <View className="gap-1">
        <Text className="text-neutral-600 dark:text-neutral-400">{bodyPrimary}</Text>
        <Text className="text-neutral-500">{bodySecondary}</Text>
      </View>
      {children}
    </View>
  );
}
