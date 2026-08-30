// Storyloom — the server-side spend guard for chapter generation (issue #6).
//
// generate-chapter and enqueue-chapter already require a signed-in owner
// (auth.ts) — that stops an anonymous or cross-family caller. It does not
// stop a signed-in owner from generating an unbounded number of chapters,
// which is the actual spend risk: every chapter costs money at two paid
// providers (text + images). This is that missing half.
//
// The exact numbers are not baked in here — the per-minute rate limit, the
// monthly cap, and whether a paying family should get a higher cap are
// product/pricing calls for Jai, not something to guess. They are read from
// env with labelled defaults instead.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const DEFAULT_RATE_LIMIT_MAX = 3;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

// Mirrors VOLUME_SIZE (src/features/reader/volumes.ts, PR #27): a month's
// allowance is meant to read as "about one book". There is no module shared
// between the Expo app and these Deno functions, so this is a second copy of
// the number by necessity, not a shared constant — once the paywall branch
// merges, its client-side allowance should probably read this config instead
// of restating the number a third time.
const DEFAULT_MONTHLY_ALLOWANCE = 10;

function envInt(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export type QuotaConfig = {
  rateLimitMax: number;
  rateLimitWindowMs: number;
  monthlyAllowance: number;
};

export function loadQuotaConfig(): QuotaConfig {
  return {
    rateLimitMax: envInt('GENERATION_RATE_LIMIT_MAX', DEFAULT_RATE_LIMIT_MAX),
    rateLimitWindowMs: envInt(
      'GENERATION_RATE_LIMIT_WINDOW_MS',
      DEFAULT_RATE_LIMIT_WINDOW_MS,
    ),
    monthlyAllowance: envInt('CHAPTER_MONTHLY_ALLOWANCE', DEFAULT_MONTHLY_ALLOWANCE),
  };
}

export type QuotaCode = 'rate_limited' | 'monthly_quota_exceeded';

/**
 * Warm, bilingual copy for a blocked request — a family that hits the cap
 * should read this as a per-volume rhythm, not a punishment.
 */
const QUOTA_COPY: Record<QuotaCode, { en: string; ko: string }> = {
  rate_limited: {
    en: 'Let\'s slow down for just a moment — try again in a minute.',
    ko: '잠시 쉬어가요 — 1분 후에 다시 시도해 주세요.',
  },
  monthly_quota_exceeded: {
    en: 'This month\'s book is finished! A new one starts next month.',
    ko: '이번 달 책이 완성되었어요! 다음 달에 새 책이 시작돼요.',
  },
};

/**
 * Thrown by reserveGenerationSlot when the rate limit or the monthly quota is
 * hit. Carries a machine-readable `code` plus copy the client can render
 * directly, rather than a bare 429.
 */
export class QuotaExceededError extends Error {
  readonly code: QuotaCode;
  readonly messageEn: string;
  readonly messageKo: string;
  readonly status = 429;

  constructor(code: QuotaCode) {
    const copy = QUOTA_COPY[code];
    super(copy.en);
    this.name = 'QuotaExceededError';
    this.code = code;
    this.messageEn = copy.en;
    this.messageKo = copy.ko;
  }

  /** The response body a caller should return — bilingual, not a bare 429. */
  toBody(): Record<string, unknown> {
    return {
      ok: false,
      code: this.code,
      error: this.messageEn,
      message_en: this.messageEn,
      message_ko: this.messageKo,
    };
  }
}

/**
 * Atomically reserves a generation slot, or throws QuotaExceededError.
 *
 * Must be called before anything that costs money. The reservation happens
 * before generation runs, so a chapter that fails at the provider still
 * consumes one of the month's — the safe direction for spend, though which
 * family absorbs a provider failure is a product call, not a technical one.
 */
export async function reserveGenerationSlot(
  supabase: SupabaseClient,
  userId: string,
  childId: string,
  config: QuotaConfig = loadQuotaConfig(),
): Promise<void> {
  const { data, error } = await supabase.rpc('reserve_generation_attempt', {
    p_user_id: userId,
    p_child_id: childId,
    p_rate_limit_max: config.rateLimitMax,
    p_rate_limit_window_ms: config.rateLimitWindowMs,
    p_monthly_allowance: config.monthlyAllowance,
  });

  if (error) {
    throw error;
  }
  if (data === 'rate_limited' || data === 'monthly_quota_exceeded') {
    throw new QuotaExceededError(data);
  }
}
