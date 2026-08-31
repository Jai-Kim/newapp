import type { ChildReadableChapter } from '@/lib/supabase/types';
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

import { currentVolume, type Volume, VOLUME_SIZE } from '@/features/reader/volumes';
import { messageOf } from '@/lib/errors';
import {
  cacheChild,
  readCachedChapters,
  readCachedChild,
} from '@/lib/offline/chapter-cache';
import { listChildren, listReadableChapters } from '@/lib/supabase/chapters';

type Lead = 'en' | 'ko';

type VolumeProgressCardProps = {
  volume: Volume;
  lead: Lead;
  childId: string | null;
  onOrderPrint: (childId: string) => void;
};

function VolumeProgressCard({ volume, lead, childId, onOrderPrint }: VolumeProgressCardProps) {
  return (
    <View
      testID="volume-progress"
      className="gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
    >
      <Text className="font-bold">
        {lead === 'ko' ? `${volume.index}권` : `Volume ${volume.index}`}
      </Text>
      <Text className="text-neutral-500">
        {lead === 'ko' ? `Volume ${volume.index}` : `${volume.index}권`}
      </Text>
      <View className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
        <View
          className="h-2 rounded-full bg-primary-600 dark:bg-primary-400"
          style={{ width: `${(volume.chapters.length / VOLUME_SIZE) * 100}%` }}
        />
      </View>
      <Text className="text-neutral-500">
        {lead === 'ko'
          ? `${VOLUME_SIZE}장 중 ${volume.chapters.length}장`
          : `${volume.chapters.length} of ${VOLUME_SIZE} chapters`}
      </Text>
      <Text className="text-neutral-500">
        {lead === 'ko'
          ? `${volume.chapters.length} of ${VOLUME_SIZE} chapters`
          : `${VOLUME_SIZE}장 중 ${volume.chapters.length}장`}
      </Text>
      {volume.complete && (
        <View testID="volume-complete" className="gap-2 pt-2">
          <Text className="font-bold text-primary-600 dark:text-primary-400">
            {lead === 'ko' ? '책이 완성되었어요!' : 'Your book is ready!'}
          </Text>
          <Text className="text-neutral-500">
            {lead === 'ko' ? 'Your book is ready!' : '책이 완성되었어요!'}
          </Text>
          {childId !== null && (
            <Button
              testID="print-order-cta"
              label={
                lead === 'ko'
                  ? '하드커버 주문 / 선물하기 · Order / gift the hardcover'
                  : 'Order / gift the hardcover · 하드커버 주문 / 선물하기'
              }
              onPress={() => onOrderPrint(childId)}
            />
          )}
        </View>
      )}
    </View>
  );
}

type ChapterRowProps = {
  chapter: ChildReadableChapter;
  lead: Lead;
  onPress: () => void;
};

function ChapterRow({ chapter, lead, onPress }: ChapterRowProps) {
  return (
    <Pressable
      onPress={onPress}
      className="gap-1 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
      testID={`read-${chapter.number}`}
    >
      <Text className="font-bold">
        {lead === 'ko' ? chapter.title_ko : chapter.title_en}
      </Text>
      <Text className="text-neutral-500">
        {lead === 'ko' ? chapter.title_en : chapter.title_ko}
      </Text>
      {chapter.read_at === null && (
        <>
          <Text className="text-xs font-bold text-primary-600 uppercase dark:text-primary-400">
            {lead === 'ko' ? '아직 안 읽었어요' : 'not read yet'}
          </Text>
          <Text className="text-xs font-bold text-neutral-500 uppercase">
            {lead === 'ko' ? 'not read yet' : '아직 안 읽었어요'}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function LibraryEmptyState({ lead }: { lead: Lead }) {
  return (
    <View className="gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <Text className="font-bold">
        {lead === 'ko' ? '아직 읽을 챕터가 없어요' : 'Nothing to read yet'}
      </Text>
      <Text className="text-neutral-500">
        {lead === 'ko' ? 'Nothing to read yet' : '아직 읽을 챕터가 없어요'}
      </Text>
      <Text className="text-neutral-600 dark:text-neutral-400">
        {lead === 'ko'
          ? '어른이 먼저 읽고 괜찮다고 하면 여기에 챕터가 나타나요.'
          : 'Chapters appear here once a grown-up has read them and said yes.'}
      </Text>
      <Text className="text-neutral-600 dark:text-neutral-400">
        {lead === 'ko'
          ? 'Chapters appear here once a grown-up has read them and said yes.'
          : '어른이 먼저 읽고 괜찮다고 하면 여기에 챕터가 나타나요.'}
      </Text>
    </View>
  );
}

function OfflineNotice({ lead }: { lead: Lead }) {
  return (
    <View testID="library-offline" className="gap-1">
      <Text className="text-neutral-500">
        {lead === 'ko'
          ? '오프라인이에요 — 기기에 저장된 챕터를 보여드려요.'
          : 'Offline — showing the chapters saved on this device.'}
      </Text>
      <Text className="text-neutral-500">
        {lead === 'ko'
          ? 'Offline — showing the chapters saved on this device.'
          : '오프라인이에요 — 기기에 저장된 챕터를 보여드려요.'}
      </Text>
    </View>
  );
}

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
  const [lead, setLead] = React.useState<Lead>('en');
  const [childId, setChildId] = React.useState<string | null>(null);
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
          setChildId(cached.id);
          setChapters(readCachedChapters(cached.id));
          setLoading(false);
        }

        const kids = await listChildren();
        if (kids.length === 0) {
          setLoading(false);
          return;
        }
        setLead(kids[0].primary_language);
        setChildId(kids[0].id);
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
          <View className="gap-1">
            <Text className="text-2xl font-bold">
              {lead === 'ko' ? '전체 챕터' : 'All chapters'}
            </Text>
            <Text className="text-neutral-500">
              {lead === 'ko' ? 'All chapters' : '전체 챕터'}
            </Text>
          </View>

          {volume !== null && (
            <VolumeProgressCard
              volume={volume}
              lead={lead}
              childId={childId}
              onOrderPrint={id => router.push(
                `/print-order/${volume.index}?childId=${id}&lead=${lead}`,
              )}
            />
          )}

          {offline && <OfflineNotice lead={lead} />}

          {error !== null && <Text className="text-danger-600">{error}</Text>}

          {chapters.length === 0 && error === null && <LibraryEmptyState lead={lead} />}

          {chapters.map(c => (
            <ChapterRow
              key={c.id}
              chapter={c}
              lead={lead}
              onPress={() => router.push(`/read/${c.id}`)}
            />
          ))}
        </View>
      </ScrollView>
    </>
  );
}
