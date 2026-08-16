import type { ChildReadableChapter } from '@/lib/supabase/types';

import { Image } from 'expo-image';
import * as React from 'react';

import {
  ActivityIndicator,
  FocusAwareStatusBar,
  Pressable,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import {
  listChildren,
  listReadableChapters,
  signImagePaths,
} from '@/lib/supabase/chapters';

/**
 * The read-together view.
 *
 * Reads `child_readable_chapters`, never `chapters` — so an unapproved or
 * filter-blocked chapter cannot appear here even if this component is wrong.
 * The gate lives in Postgres; this screen just can't see past it.
 *
 * Both languages are always on the page (ADR-0001 §1). The child's
 * primary_language decides which one leads, so a Korean-first family reads
 * Korean at full size with English beneath, and an English-first family gets
 * the reverse — same page, same book, either grandparent can read it.
 */
export function ReaderScreen() {
  const [chapters, setChapters] = React.useState<ChildReadableChapter[]>([]);
  const [lead, setLead] = React.useState<'en' | 'ko'>('en');
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [urls, setUrls] = React.useState<Record<string, string>>({});
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
        setUrls(
          await signImagePaths(
            list.flatMap(c => c.pages.map(p => p.image_path).filter(Boolean) as string[]),
          ),
        );
      }
      catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      finally {
        setLoading(false);
      }
    })();
  }, []);

  const open = chapters.find(c => c.id === openId);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (open) {
    return <ChapterView chapter={open} lead={lead} urls={urls} onBack={() => setOpenId(null)} />;
  }

  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView>
        <View className="flex-1 gap-4 p-4">
          <Text className="text-2xl font-bold">Storybook</Text>

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
              onPress={() => setOpenId(c.id)}
              className="gap-1 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
              testID={`read-${c.number}`}
            >
              <Text className="font-bold">
                {lead === 'ko' ? c.title_ko : c.title_en}
              </Text>
              <Text className="text-neutral-500">
                {lead === 'ko' ? c.title_en : c.title_ko}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

function ChapterView({
  chapter,
  lead,
  urls,
  onBack,
}: {
  chapter: ChildReadableChapter;
  lead: 'en' | 'ko';
  urls: Record<string, string>;
  onBack: () => void;
}) {
  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView>
        <View className="flex-1 gap-5 p-4 pb-12">
          <Pressable onPress={onBack}>
            <Text className="text-primary-600 dark:text-primary-400">
              ← Back to the library
            </Text>
          </Pressable>
          <Text className="text-2xl font-bold">
            {lead === 'ko' ? chapter.title_ko : chapter.title_en}
          </Text>
          <Text className="text-lg text-neutral-500">
            {lead === 'ko' ? chapter.title_en : chapter.title_ko}
          </Text>

          {chapter.pages.map((page) => {
            const uri = page.image_path ? urls[page.image_path] : undefined;
            return (
              <View key={page.page} className="gap-3">
                {uri && (
                  <Image
                    source={{ uri }}
                    style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 12 }}
                    contentFit="cover"
                    transition={200}
                  />
                )}
                <Text className="text-lg/8">
                  {lead === 'ko' ? page.ko : page.en}
                </Text>
                <Text className="leading-7 text-neutral-600 dark:text-neutral-400">
                  {lead === 'ko' ? page.en : page.ko}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </>
  );
}
