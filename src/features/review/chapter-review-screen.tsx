import type { Chapter, ChapterPage, SafetyConcern } from '@/lib/supabase/types';
import { Image } from 'expo-image';

import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import {
  ActivityIndicator,
  Button,
  FocusAwareStatusBar,
  ScrollView,
  Text,
  View,
} from '@/components/ui';

import { AiGeneratedNotice } from '@/features/legal/ai-generated-notice';
import { messageOf } from '@/lib/errors';
import { readCachedChild } from '@/lib/offline/chapter-cache';
import {
  getChapterForReview,
  getChild,
  setChapterApproval,
  signImagePaths,
} from '@/lib/supabase/chapters';

type Lead = 'en' | 'ko';

/**
 * What a parent actually reads before deciding.
 *
 * Shows both languages and the filter's advisory notes together. A parent whose
 * Korean is stronger than their English (or the reverse) needs to be able to
 * judge the version they will actually read aloud — showing only English would
 * mean approving text they cannot check.
 */
export function ChapterReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [chapter, setChapter] = React.useState<Chapter | null>(null);
  const [urls, setUrls] = React.useState<Record<string, string>>({});
  const [lead, setLead] = React.useState<Lead>('en');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const ch = await getChapterForReview(id);
        setChapter(ch);
        const paths = ch.pages.map(p => p.image_path).filter(Boolean) as string[];
        setUrls(await signImagePaths(paths));

        // The cache already has this child on any device that's read a
        // chapter or opened the library — no extra network round trip on
        // that (common) path. Only fall back to a fetch when it's missing
        // or belongs to a different child.
        const cached = readCachedChild();
        if (cached !== null && cached.id === ch.child_id) {
          setLead(cached.primary_language);
        }
        else {
          const child = await getChild(ch.child_id);
          setLead(child.primary_language);
        }
      }
      catch (e) {
        setError(messageOf(e));
      }
    })();
  }, [id]);

  const decide = async (approved: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await setChapterApproval(id, approved);
      router.back();
    }
    catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  };

  if (error !== null && !chapter) {
    return (
      <View className="flex-1 p-4">
        <Text className="text-danger-600">{error}</Text>
      </View>
    );
  }
  if (!chapter) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  const blocked = chapter.safety?.verdict === 'blocked';

  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView>
        <View className="flex-1 gap-5 p-4 pb-10">
          <ChapterHeader chapter={chapter} lead={lead} />

          <AiGeneratedNotice lead={lead} />

          {blocked && <BlockedBanner lead={lead} />}

          <SafetyNotes concerns={chapter.safety?.concerns ?? []} lead={lead} />

          {chapter.pages.map(page => (
            <PageCard key={page.page} page={page} urls={urls} lead={lead} />
          ))}

          {error !== null && (
            <Text className="text-danger-600">{error}</Text>
          )}

          {!blocked && (
            <Decision
              approved={chapter.review_status === 'approved'}
              busy={busy}
              lead={lead}
              onDecide={decide}
            />
          )}
        </View>
      </ScrollView>
    </>
  );
}

/**
 * Title (already bilingual on the chapter row) plus the lesson label. The
 * label is bilingual; `chapter.lesson` itself is not — it's the English
 * value stored on the row and mirrored from the server's fallback lesson
 * list (issue #22, follow-up to #43), so translating or looking it up here
 * would drift from what `generate-chapter` actually matched against.
 */
function ChapterHeader({ chapter, lead }: { chapter: Chapter; lead: Lead }) {
  return (
    <View className="gap-1">
      <Text className="text-2xl font-bold">{chapter.title_en}</Text>
      <Text className="text-lg text-neutral-600 dark:text-neutral-400">
        {chapter.title_ko}
      </Text>
      {chapter.lesson !== null && (
        <Text className="text-neutral-500 italic">
          {lead === 'ko'
            ? `오늘 밤의 교훈 · Tonight's lesson — ${chapter.lesson}`
            : `Tonight's lesson · 오늘 밤의 교훈 — ${chapter.lesson}`}
        </Text>
      )}
    </View>
  );
}

/**
 * The single highest-stakes string on this screen: it's the reason the
 * approve buttons are gone. Both languages, always, per ADR-0001 §1 — a
 * parent who can't read this sees a red box and no way forward.
 */
function BlockedBanner({ lead }: { lead: Lead }) {
  const heading = lead === 'ko' ? '안전 필터에 걸렸어요' : 'Blocked by the content filter';
  const headingOff = lead === 'ko' ? 'Blocked by the content filter' : '안전 필터에 걸렸어요';
  const body = lead === 'ko'
    ? '이 챕터는 승인할 수 없어요. 새로 만들어 주세요.'
    : 'This chapter can\'t be approved. Generate a new one instead.';
  const bodyOff = lead === 'ko'
    ? 'This chapter can\'t be approved. Generate a new one instead.'
    : '이 챕터는 승인할 수 없어요. 새로 만들어 주세요.';

  return (
    <View className="gap-1 rounded-md bg-danger-100 p-3 dark:bg-danger-900">
      <Text className="font-bold text-danger-800 dark:text-danger-100">{heading}</Text>
      <Text className="font-bold text-danger-800 dark:text-danger-100">{headingOff}</Text>
      <Text className="mt-1 text-danger-800 dark:text-danger-100">{body}</Text>
      <Text className="text-danger-800 dark:text-danger-100">{bodyOff}</Text>
    </View>
  );
}

/**
 * The heading is bilingual; each concern's text (`c.issue`) is not. It comes
 * straight from the safety filter (`supabase/functions/_shared/safety.ts`),
 * which reasons and writes in English only server-side — translating it
 * client-side would risk misrepresenting what the filter actually flagged.
 * Closing that gap is a follow-up, not this PR.
 */
function SafetyNotes({ concerns, lead }: { concerns: SafetyConcern[]; lead: Lead }) {
  if (concerns.length === 0) {
    return null;
  }
  return (
    <View className="gap-2 rounded-md border border-warning-300 p-3 dark:border-warning-700">
      <Text className="text-xs font-bold tracking-wider text-warning-700 uppercase dark:text-warning-300">
        {lead === 'ko'
          ? '참고하시면 좋아요 · Things you might want to know'
          : 'Things you might want to know · 참고하시면 좋아요'}
      </Text>
      {concerns.map(c => (
        <Text
          key={`${c.page}-${c.issue.slice(0, 24)}`}
          className="text-neutral-700 dark:text-neutral-300"
        >
          •
          {' '}
          {c.issue}
        </Text>
      ))}
    </View>
  );
}

function PageCard({
  page,
  urls,
  lead,
}: {
  page: ChapterPage;
  urls: Record<string, string>;
  lead: Lead;
}) {
  const uri = page.image_path ? urls[page.image_path] : undefined;
  return (
    <View className="gap-3 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700">
      {uri && (
        <Image
          source={{ uri }}
          style={{ width: '100%', aspectRatio: 4 / 3 }}
          contentFit="cover"
          transition={200}
        />
      )}
      <View className="gap-3 p-4">
        <Text className="text-xs text-neutral-500">
          {lead === 'ko' ? `${page.page}쪽 · Page ${page.page}` : `Page ${page.page} · ${page.page}쪽`}
        </Text>
        <Text>{page.en}</Text>
        <Text className="text-neutral-700 dark:text-neutral-300">{page.ko}</Text>
      </View>
    </View>
  );
}

function Decision({
  approved,
  busy,
  lead,
  onDecide,
}: {
  approved: boolean;
  busy: boolean;
  lead: Lead;
  onDecide: (approved: boolean) => void;
}) {
  const approveEn = approved ? 'Approved — tap to re-approve' : 'Approve for reading';
  const approveKo = approved ? '승인됨 — 다시 승인하려면 탭하세요' : '읽어도 좋아요';
  const approveLabel = lead === 'ko' ? `${approveKo} · ${approveEn}` : `${approveEn} · ${approveKo}`;
  const rejectLabel = lead === 'ko' ? '이건 아니에요 · Not this one' : 'Not this one · 이건 아니에요';

  return (
    <View className="gap-3 pt-2">
      <Button
        label={approveLabel}
        disabled={busy}
        onPress={() => onDecide(true)}
        testID="approve"
      />
      <Button
        label={rejectLabel}
        variant="secondary"
        disabled={busy}
        onPress={() => onDecide(false)}
        testID="reject"
      />
    </View>
  );
}
