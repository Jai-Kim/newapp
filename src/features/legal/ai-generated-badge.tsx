import { Text, View } from '@/components/ui';

/**
 * "Made with AI" mark shown wherever a generated chapter is shown — the
 * parent preview and the child reader (issue #12). Both languages always
 * render, `lead` just decides which is on top, matching the rest of the
 * app's bilingual convention (ADR-0001 §1).
 */
export function AiGeneratedBadge({
  lead = 'en',
  className = '',
}: {
  lead?: 'en' | 'ko';
  className?: string;
}) {
  const en = 'Made with AI, reviewed by a parent';
  const ko = 'AI로 제작 · 부모님이 검토했어요';
  const first = lead === 'ko' ? ko : en;
  const second = lead === 'ko' ? en : ko;

  return (
    <View
      testID="ai-generated-badge"
      className={`self-start gap-0.5 rounded-full border border-neutral-300 px-3 py-1 dark:border-neutral-600 ${className}`}
    >
      <Text className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
        {first}
      </Text>
      <Text className="text-[10px] text-neutral-500 dark:text-neutral-400">
        {second}
      </Text>
    </View>
  );
}
