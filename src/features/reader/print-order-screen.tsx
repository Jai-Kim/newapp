import type { ShippingAddress } from '@/lib/supabase/types';
import { useLocalSearchParams, useRouter } from 'expo-router';

import * as React from 'react';
import {
  Button,
  Checkbox,
  FocusAwareStatusBar,
  Input,
  ScrollView,
  Text,
  View,
} from '@/components/ui';

import { INDICATIVE_HARDCOVER_PRICE_USD } from '@/features/reader/print-order-config';
import { messageOf } from '@/lib/errors';
import { submitPrintOrder } from '@/lib/supabase/print-orders';

/**
 * Concierge print capture (issue #22, ADR-0003, slice 4): at Volume
 * completion, a parent can ask for the hardcover. Intent + shipping details
 * only — no payment collection, no POD integration yet. The first 100 are
 * fulfilled by hand.
 *
 * Reached from the library screen's "book ready" moment, which passes the
 * child and the completed volume's index. The chapter snapshot itself is
 * computed server-side (submit-print-order), not here — this screen only
 * ever sends what the parent typed.
 */
export function PrintOrderScreen() {
  const router = useRouter();
  const { childId, volumeIndex, lead: leadParam } = useLocalSearchParams<{
    childId?: string;
    volumeIndex?: string;
    lead?: string;
  }>();
  const lead = leadParam === 'ko' ? 'ko' : 'en';

  const [recipientName, setRecipientName] = React.useState('');
  const [line1, setLine1] = React.useState('');
  const [line2, setLine2] = React.useState('');
  const [city, setCity] = React.useState('');
  const [stateOrProvince, setStateOrProvince] = React.useState('');
  const [postalCode, setPostalCode] = React.useState('');
  const [country, setCountry] = React.useState('');
  const [gift, setGift] = React.useState(false);
  const [giftMessage, setGiftMessage] = React.useState('');
  const [note, setNote] = React.useState('');

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<'ordered' | 'already_ordered' | null>(null);

  const canSubmit
    = recipientName.trim().length > 0
      && line1.trim().length > 0
      && city.trim().length > 0
      && postalCode.trim().length > 0
      && country.trim().length > 0;

  const submit = async () => {
    if (!childId || !volumeIndex) {
      setError('Missing volume — go back to the library and try again.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const shipping_address: ShippingAddress = {
        line1: line1.trim(),
        line2: line2.trim() || null,
        city: city.trim(),
        state: stateOrProvince.trim() || null,
        postal_code: postalCode.trim(),
        country: country.trim(),
      };
      const response = await submitPrintOrder({
        child_id: childId,
        volume_index: Number(volumeIndex),
        recipient_name: recipientName.trim(),
        shipping_address,
        gift,
        gift_message: gift ? giftMessage.trim() || undefined : undefined,
        note: note.trim() || undefined,
      });
      setResult(response.already_ordered ? 'already_ordered' : 'ordered');
    }
    catch (e) {
      setError(messageOf(e));
    }
    finally {
      setBusy(false);
    }
  };

  if (result !== null) {
    return (
      <>
        <FocusAwareStatusBar />
        <View
          testID="print-order-confirmation"
          className="flex-1 items-center justify-center gap-3 p-6"
        >
          <Text className="text-center text-xl font-bold">
            {result === 'already_ordered'
              ? (lead === 'ko' ? '이 책은 이미 주문되었어요.' : 'This book has already been ordered.')
              : (lead === 'ko' ? '주문이 접수되었어요!' : 'Your order is in!')}
          </Text>
          <Text className="text-center text-neutral-600 dark:text-neutral-400">
            {result === 'already_ordered'
              ? (lead === 'ko' ? 'This book has already been ordered.' : '이 책은 이미 주문되었어요.')
              : (lead === 'ko' ? 'Your order is in!' : '주문이 접수되었어요!')}
          </Text>
          <Text className="text-center text-neutral-600 dark:text-neutral-400">
            {lead === 'ko'
              ? '저희가 직접 손으로 준비해서 곧 연락드릴게요.'
              : 'We prepare these by hand and will be in touch soon.'}
          </Text>
          <Text className="text-center text-neutral-600 dark:text-neutral-400">
            {lead === 'ko'
              ? 'We prepare these by hand and will be in touch soon.'
              : '저희가 직접 손으로 준비해서 곧 연락드릴게요.'}
          </Text>
          <Button
            testID="print-order-done"
            label={lead === 'ko' ? '서재로 돌아가기' : 'Back to the library'}
            onPress={() => router.back()}
          />
        </View>
      </>
    );
  }

  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView>
        <View className="flex-1 gap-4 p-4 pb-12">
          <View className="gap-1">
            <Text className="text-2xl font-bold">
              {lead === 'ko' ? '하드커버 주문 / 선물하기' : 'Order / gift the hardcover'}
            </Text>
            <Text className="text-neutral-600 dark:text-neutral-400">
              {lead === 'ko' ? 'Order / gift the hardcover' : '하드커버 주문 / 선물하기'}
            </Text>
          </View>

          <View className="gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
            <Text className="text-neutral-600 dark:text-neutral-400">
              {`About $${INDICATIVE_HARDCOVER_PRICE_USD} (indicative — you won't be charged here)`}
            </Text>
            <Text className="text-neutral-600 dark:text-neutral-400">
              {`약 $${INDICATIVE_HARDCOVER_PRICE_USD} (예상 금액 — 지금은 결제되지 않아요)`}
            </Text>
            <Text className="text-sm text-neutral-500">
              No payment happens here — just shipping details for now. We are
              making the first 100 of these by hand.
            </Text>
            <Text className="text-sm text-neutral-500">
              지금은 결제 없이 배송 정보만 받아요. 처음 100권은 저희가 직접 손으로 만들어 보내드려요.
            </Text>
          </View>

          <Checkbox
            testID="print-order-gift"
            checked={gift}
            onChange={setGift}
            accessibilityLabel="This is a gift / 선물이에요"
            label="This is a gift / 선물이에요"
          />

          <Input
            testID="print-order-recipient"
            label={gift ? 'Recipient name / 받는 분 이름' : 'Name / 이름'}
            value={recipientName}
            onChangeText={setRecipientName}
            placeholder="Jane Doe"
          />

          {gift && (
            <Input
              testID="print-order-gift-message"
              label="Gift message (optional) / 선물 메시지 (선택)"
              value={giftMessage}
              onChangeText={setGiftMessage}
              multiline
            />
          )}

          <Input
            testID="print-order-line1"
            label="Address / 주소"
            value={line1}
            onChangeText={setLine1}
            placeholder="123 Main St"
          />
          <Input
            testID="print-order-line2"
            label="Address line 2 (optional) / 상세 주소 (선택)"
            value={line2}
            onChangeText={setLine2}
          />
          <Input testID="print-order-city" label="City / 도시" value={city} onChangeText={setCity} />
          <Input
            testID="print-order-state"
            label="State / Province (optional) / 주·도 (선택)"
            value={stateOrProvince}
            onChangeText={setStateOrProvince}
          />
          <Input
            testID="print-order-postal-code"
            label="Postal code / 우편번호"
            value={postalCode}
            onChangeText={setPostalCode}
          />
          <Input testID="print-order-country" label="Country / 국가" value={country} onChangeText={setCountry} />
          <Input
            testID="print-order-note"
            label="Note to us (optional) / 남기고 싶은 말 (선택)"
            value={note}
            onChangeText={setNote}
            multiline
          />

          {error !== null && (
            <View className="rounded-md bg-danger-100 p-3 dark:bg-danger-900">
              <Text className="text-danger-800 dark:text-danger-100">{error}</Text>
            </View>
          )}

          <Button
            testID="print-order-submit"
            label={busy ? 'Sending…' : 'Place order'}
            disabled={busy || !canSubmit}
            onPress={submit}
          />
        </View>
      </ScrollView>
    </>
  );
}
