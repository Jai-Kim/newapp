import { Button, Text, View } from '@/components/ui';

/**
 * What a family sees on the nights they have already had this month's book
 * (ADR-0003): warm, framed as a rhythm rather than a lockout, and — per the
 * bilingual convention every product screen follows (ADR-0001 §1) — both
 * languages always render, the child's `primary_language` decides which
 * leads.
 */
export function AllowanceNotice({
  lead,
  periodEnds,
  subscribed,
  onOpenPaywall,
}: {
  lead: 'en' | 'ko';
  periodEnds: Date;
  subscribed: boolean;
  onOpenPaywall: () => void;
}) {
  const resetDate = periodEnds.toLocaleDateString(lead === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'long',
    day: 'numeric',
  });

  return (
    <View
      testID="allowance-blocked"
      className="gap-4 rounded-xl border border-primary-300 p-5 dark:border-primary-700"
    >
      <View className="gap-1">
        <Text className="text-xl font-bold">
          {lead === 'ko' ? '이번 달 책이 완성됐어요!' : 'This month’s book is finished!'}
        </Text>
        <Text className="text-lg text-neutral-500">
          {lead === 'ko' ? 'This month’s book is finished!' : '이번 달 책이 완성됐어요!'}
        </Text>
      </View>
      <View className="gap-1">
        <Text className="text-neutral-600 dark:text-neutral-400">
          {lead === 'ko'
            ? `다음 챕터는 ${resetDate}에 다시 시작돼요. 그때까지 지금까지 쓴 챕터들을 다시 읽어보세요.`
            : `The next chapter picks up on ${resetDate}. Until then, tonight is a good night to re-read one you already love.`}
        </Text>
        <Text className="text-neutral-500">
          {lead === 'ko'
            ? `The next chapter picks up on ${resetDate}. Until then, tonight is a good night to re-read one you already love.`
            : `다음 챕터는 ${resetDate}에 다시 시작돼요. 그때까지 지금까지 쓴 챕터들을 다시 읽어보세요.`}
        </Text>
      </View>
      {!subscribed && (
        <Button onPress={onOpenPaywall} testID="open-paywall-from-allowance">
          <View className="items-center gap-0.5 py-1">
            <Text className="font-semibold text-white dark:text-black">
              {lead === 'ko' ? '구독 옵션 보기' : 'See subscription options'}
            </Text>
            <Text className="text-xs text-neutral-300 dark:text-neutral-600">
              {lead === 'ko' ? 'See subscription options' : '구독 옵션 보기'}
            </Text>
          </View>
        </Button>
      )}
    </View>
  );
}
