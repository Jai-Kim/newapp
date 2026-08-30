/**
 * The sensitive-topic disclaimer shown wherever a parent types a situation
 * (issue #13) — the same wording as `SENSITIVE_TOPIC_DISCLAIMER` in
 * `supabase/functions/_shared/crisis-response.ts`. Duplicated rather than
 * shared for the same reason `VOLUME_SIZE`/`CHAPTER_MONTHLY_ALLOWANCE` are:
 * this runs in the Expo/Metro bundle, that one in a Deno Edge Function —
 * different toolchains, no module boundary between them to share across.
 *
 * Status: engineering draft — same standing as docs/privacy-policy.md and
 * docs/sensitive-topics-policy.md. Not legally cleared.
 */
export const SENSITIVE_TOPIC_DISCLAIMER = {
  en: 'Storyloom writes bedtime stories. It is not medical, psychological, or '
    + 'therapeutic advice, and it is not a crisis service.',
  ko: 'Storyloom은 잠자리 동화를 쓰는 서비스예요. 의료, 심리, 치료 상담이 아니며, '
    + '위기 상담 서비스도 아니에요.',
};
