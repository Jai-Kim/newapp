import * as React from 'react';

import { Pressable, Text, View } from '@/components/ui';

/**
 * Tap-to-choose chips.
 *
 * Both onboarding steps are the same shape — a labelled group of mutually
 * exclusive (or multi-select) options — because a parent setting up at bedtime
 * should be tapping, not typing. Shared so the two screens cannot drift into
 * looking like different apps.
 */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-3">
      <Text className="font-bold">{label}</Text>
      {hint !== undefined && (
        <Text className="-mt-2 text-sm text-neutral-500">{hint}</Text>
      )}
      {children}
    </View>
  );
}

export function ChipRow({
  children,
  wrap,
}: {
  children: React.ReactNode;
  wrap?: boolean;
}) {
  return (
    <View className={`flex-row gap-2 ${wrap ? 'flex-wrap' : ''}`}>{children}</View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={
        selected
          ? 'rounded-full bg-primary-600 px-4 py-2'
          : 'rounded-full border border-neutral-300 px-4 py-2 dark:border-neutral-600'
      }
    >
      <Text className={selected ? 'font-bold text-white' : ''}>{label}</Text>
    </Pressable>
  );
}
