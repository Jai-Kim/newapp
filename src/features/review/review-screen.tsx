import type { ChapterSummary, ChildRow } from '@/lib/supabase/chapters';
import { useRouter } from 'expo-router';

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

import { messageOf } from '@/lib/errors';
import { listAllChapters, listChildren } from '@/lib/supabase/chapters';

/**
 * The parent's queue.
 *
 * Nothing a child can read exists until a parent acts here — every chapter is
 * written as `pending`, so this screen is the only door. It deliberately shows
 * the safety notes alongside each chapter rather than hiding them: the filter's
 * advisories ("the child handles a lit lantern") are the useful part for a
 * caregiver, not just plumbing.
 */
export function ReviewScreen() {
  const router = useRouter();
  const [children, setChildren] = React.useState<ChildRow[]>([]);
  const [chapters, setChapters] = React.useState<ChapterSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const kids = await listChildren();
      setChildren(kids);
      setChapters(kids.length ? await listAllChapters(kids[0].id) : []);
    }
    catch (e) {
      setError(messageOf(e));
    }
    finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const pending = chapters.filter(c => c.review_status === 'pending');
  const decided = chapters.filter(c => c.review_status !== 'pending');

  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView>
        <View className="flex-1 gap-5 p-4">
          <View className="gap-1">
            <Text className="text-2xl font-bold">Tonight's review</Text>
            <Text className="text-neutral-600 dark:text-neutral-400">
              Nothing reaches
              {' '}
              {children[0]?.first_name ?? 'your child'}
              {' '}
              until you say so.
            </Text>
          </View>

          {loading && <ActivityIndicator />}

          {error !== null && (
            <View className="gap-2 rounded-md bg-danger-100 p-3 dark:bg-danger-900">
              <Text className="text-danger-800 dark:text-danger-100">{error}</Text>
            </View>
          )}

          {!loading && children.length === 0 && (
            <View className="gap-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-700">
              <Text className="font-bold">No child profile yet</Text>
              <Text className="text-neutral-600 dark:text-neutral-400">
                Set up your child to start tonight's story.
              </Text>
              <Button
                label="Set up"
                onPress={() => router.push('/child-setup')}
                testID="go-setup"
              />
            </View>
          )}

          <Section
            title={`${pending.length} waiting for you`}
            tone="text-primary-600 dark:text-primary-400"
            chapters={pending}
            onOpen={id => router.push(`/review/${id}`)}
          />

          {!loading && pending.length === 0 && children.length > 0 && (
            <Text className="text-neutral-500">Nothing waiting. All caught up.</Text>
          )}

          <Section
            title="Already decided"
            tone="text-neutral-500"
            chapters={decided}
            onOpen={id => router.push(`/review/${id}`)}
          />
        </View>
      </ScrollView>
    </>
  );
}

function ChapterRow({
  chapter,
  onPress,
}: {
  chapter: ChapterSummary;
  onPress: () => void;
}) {
  const tone
    = chapter.review_status === 'approved'
      ? 'text-success-600 dark:text-success-400'
      : chapter.review_status === 'rejected'
        ? 'text-danger-600 dark:text-danger-400'
        : 'text-primary-600 dark:text-primary-400';

  return (
    <Pressable
      onPress={onPress}
      className="gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
      testID={`chapter-${chapter.number}`}
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-bold">
          {chapter.number}
          .
          {' '}
          {chapter.title_en}
        </Text>
        <Text className={`text-xs font-bold uppercase ${tone}`}>
          {chapter.review_status}
        </Text>
      </View>
      <Text className="text-neutral-600 dark:text-neutral-400" numberOfLines={2}>
        {chapter.summary}
      </Text>
      <View className="flex-row gap-3">
        {chapter.has_art && <Meta label="illustrated" />}
        {chapter.concern_count > 0 && (
          <Meta label={`${chapter.concern_count} safety note${chapter.concern_count === 1 ? '' : 's'}`} />
        )}
      </View>
    </Pressable>
  );
}

function Meta({ label }: { label: string }) {
  return (
    <Text className="text-xs text-neutral-500">{label}</Text>
  );
}

function Section({
  title,
  tone,
  chapters,
  onOpen,
}: {
  title: string;
  tone: string;
  chapters: ChapterSummary[];
  onOpen: (id: string) => void;
}) {
  if (chapters.length === 0) {
    return null;
  }
  return (
    <View className="gap-3 pt-2">
      <Text className={`text-xs font-bold tracking-wider uppercase ${tone}`}>
        {title}
      </Text>
      {chapters.map(c => (
        <ChapterRow key={c.id} chapter={c} onPress={() => onOpen(c.id)} />
      ))}
    </View>
  );
}
