import type { ChildReadableChapter } from '@/lib/supabase/types';
import { useRouter } from 'expo-router';

import * as React from 'react';
import {
  ActivityIndicator,
  FocusAwareStatusBar,
  Pressable,
  ScrollView,
  Text,
  View,
} from '@/components/ui';

import { messageOf } from '@/lib/errors';
import { listChildren, listReadableChapters } from '@/lib/supabase/chapters';

/**
 * Everything they have read so far.
 *
 * Not the home screen — that is `TonightScreen`, which opens straight on the
 * one chapter that matters tonight. This is the shelf you go to when you want
 * to read an old favourite again, and it shows which ones have been read.
 */
export function LibraryScreen() {
  const router = useRouter();
  const [chapters, setChapters] = React.useState<ChildReadableChapter[]>([]);
  const [lead, setLead] = React.useState<'en' | 'ko'>('en');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const kids = await listChildren();
        if (kids.length === 0) {
          setLoading(false);
          return;
        }
        setLead(kids[0].primary_language);
        const list = await listReadableChapters(kids[0].id);
        setChapters(list);
      }
      catch (e) {
        setError(messageOf(e));
      }
      finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
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
        <View className="flex-1 gap-4 p-4">
          <Text className="text-2xl font-bold">All chapters</Text>

          {error !== null && <Text className="text-danger-600">{error}</Text>}

          {chapters.length === 0 && error === null && (
            <View className="gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
              <Text className="font-bold">Nothing to read yet</Text>
              <Text className="text-neutral-600 dark:text-neutral-400">
                Chapters appear here once a grown-up has read them and said yes.
              </Text>
            </View>
          )}

          {chapters.map(c => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/read/${c.id}`)}
              className="gap-1 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
              testID={`read-${c.number}`}
            >
              <Text className="font-bold">
                {lead === 'ko' ? c.title_ko : c.title_en}
              </Text>
              <Text className="text-neutral-500">
                {lead === 'ko' ? c.title_en : c.title_ko}
              </Text>
              {c.read_at === null && (
                <Text className="text-xs font-bold text-primary-600 uppercase dark:text-primary-400">
                  not read yet
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </>
  );
}
