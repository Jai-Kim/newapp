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
import {
  getChapterForReview,
  setChapterApproval,
  signImagePaths,
} from '@/lib/supabase/chapters';

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
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const ch = await getChapterForReview(id);
        setChapter(ch);
        const paths = ch.pages.map(p => p.image_path).filter(Boolean) as string[];
        setUrls(await signImagePaths(paths));
      }
      catch (e) {
        setError(e instanceof Error ? e.message : String(e));
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
      setError(e instanceof Error ? e.message : String(e));
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
          <View className="gap-1">
            <Text className="text-2xl font-bold">{chapter.title_en}</Text>
            <Text className="text-lg text-neutral-600 dark:text-neutral-400">
              {chapter.title_ko}
            </Text>
            {chapter.lesson !== null && (
              <Text className="text-neutral-500 italic">
                Tonight's lesson —
                {' '}
                {chapter.lesson}
              </Text>
            )}
          </View>

          {blocked && (
            <View className="rounded-md bg-danger-100 p-3 dark:bg-danger-900">
              <Text className="font-bold text-danger-800 dark:text-danger-100">
                Blocked by the content filter
              </Text>
              <Text className="text-danger-800 dark:text-danger-100">
                This chapter can't be approved. Generate a new one instead.
              </Text>
            </View>
          )}

          <SafetyNotes concerns={chapter.safety?.concerns ?? []} />

          {chapter.pages.map(page => (
            <PageCard key={page.page} page={page} urls={urls} />
          ))}

          {error !== null && (
            <Text className="text-danger-600">{error}</Text>
          )}

          {!blocked && (
            <Decision
              approved={chapter.review_status === 'approved'}
              busy={busy}
              onDecide={decide}
            />
          )}
        </View>
      </ScrollView>
    </>
  );
}

function SafetyNotes({ concerns }: { concerns: SafetyConcern[] }) {
  if (concerns.length === 0) {
    return null;
  }
  return (
    <View className="gap-2 rounded-md border border-warning-300 p-3 dark:border-warning-700">
      <Text className="text-xs font-bold tracking-wider text-warning-700 uppercase dark:text-warning-300">
        Things you might want to know
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
}: {
  page: ChapterPage;
  urls: Record<string, string>;
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
          Page
          {' '}
          {page.page}
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
  onDecide,
}: {
  approved: boolean;
  busy: boolean;
  onDecide: (approved: boolean) => void;
}) {
  return (
    <View className="gap-3 pt-2">
      <Button
        label={approved ? 'Approved — tap to re-approve' : 'Approve for reading'}
        disabled={busy}
        onPress={() => onDecide(true)}
        testID="approve"
      />
      <Button
        label="Not this one"
        variant="secondary"
        disabled={busy}
        onPress={() => onDecide(false)}
        testID="reject"
      />
    </View>
  );
}
