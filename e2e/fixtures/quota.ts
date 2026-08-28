/**
 * Mirrors the default and bilingual copy in
 * supabase/functions/_shared/quota.ts (issue #6).
 *
 * Stub mode intercepts the network call before the real Edge Function ever
 * runs (see the note at the top of support/stubs.ts), so it cannot import
 * that Deno module directly — this is the same trade every other stub in
 * this suite makes. Keeping the mirrored values in one file, rather than
 * inline in the stub, makes a copy drifting out of sync from quota.ts easy
 * to spot and fix in one place.
 */
export const MONTHLY_CHAPTER_ALLOWANCE = 10;

export const QUOTA_MESSAGES = {
  monthly_quota_reached: {
    en: "This month's book is already full of chapters — what a lot of "
      + 'story! The next book starts next month.',
    ko: '이번 달 책이 이야기로 가득 찼어요! 다음 책은 다음 달에 시작돼요.',
  },
} as const;
