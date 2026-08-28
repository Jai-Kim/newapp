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
import {
  cacheChild,
  readCachedChapters,
  readCachedChild,
} from '@/lib/offline/chapter-cache';
import { listChildren, listReadableChapters } from '@/lib/supabase/chapters';

import { currentVolume, VOLUME_SIZE, type Volume } from './volumes';

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
  const [offline, setOffline] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        // The device first, so the shelf is there with no network at all.
        const cached = readCachedChild();
        if (cached !== null) {
          setLead(cached.primary_language);
          setChapters(readCachedChapters(cached.id));
          setLoading(false);
        }

        const kids = await listChildren();
        if (kids.length === 0) {
          setLoading(false);
          return;
        }
        setLead(kids[0].primary_language);
        cacheChild(kids[0]);
        const list = await listReadableChapters(kids[0].id);
        setChapters(list);
      }
      catch (e) {
        const cached = readCachedChild();
        if (cached === null || readCachedChapters(cached.id).length === 0) {
          setError(messageOf(e));
        }
        else {
          setOffline(true);
        }
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

  const volume = currentVolume(chapters);

  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView>
        <View className="flex-1 gap-4 p-4">
          <Text className="text-2xl font-bold">All chapters</Text>

          {volume !== null && <VolumeProgress volume={volume} lead={lead} />}

          {offline && (
            <Text testID="library-offline" className="text-neutral-500">
              Offline — showing the chapters saved on this device.
            </Text>
          )}

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

/** Both languages always render, lead first (ADR-0001 §3). */
function bilingual(lead: 'en' | 'ko', en: string, ko: string): [string, string] {
  return lead === 'ko' ? [ko, en] : [en, ko];
}

/**
 * The current Volume filling up, and the "your book is ready" moment at 10
 * chapters (ADR-0003) — the shelf's spine, not just a list of chapters.
 */
function VolumeProgress({ lead, volume }: { lead: 'en' | 'ko'; volume: Volume }) {
  const count = volume.chapters.length;
  const pct = Math.round((count / VOLUME_SIZE) * 100);

  const [title, titleSecondary] = bilingual(
    lead,
    `Volume ${volume.index}`,
    `${volume.index}권`,
  );
  const [progress, progressSecondary] = bilingual(
    lead,
    `${count} of ${VOLUME_SIZE} chapters`,
    `챕터 ${count}/${VOLUME_SIZE}`,
  );

  return (
    <View
      testID="volume-progress"
      className="gap-2 rounded-xl border border-primary-300 p-4 dark:border-primary-700"
    >
      <Text className="text-lg font-bold">{title}</Text>
      <Text className="text-sm text-neutral-500">{titleSecondary}</Text>

      <View className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
        <View
          className="h-2 rounded-full bg-primary-600 dark:bg-primary-400"
          style={{ width: `${pct}%` }}
        />
      </View>

      <Text className="text-neutral-600 dark:text-neutral-400">{progress}</Text>
      <Text className="text-sm text-neutral-500">{progressSecondary}</Text>

      {volume.complete && (
        <VolumeReadyBanner lead={lead} />
      )}
    </View>
  );
}

function VolumeReadyBanner({ lead }: { lead: 'en' | 'ko' }) {
  const [ready, readySecondary] = bilingual(lead, 'Your book is ready!', '책이 완성되었어요!');

  return (
    <View testID="volume-complete" className="gap-1 pt-2">
      <Text className="font-bold text-primary-600 dark:text-primary-400">{ready}</Text>
      <Text className="text-sm text-neutral-500">{readySecondary}</Text>
    </View>
  );
}
