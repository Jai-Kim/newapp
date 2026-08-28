// Storyloom — abuse & cost protection on the chapter-generation path (issue #6).
//
// generate-chapter and enqueue-chapter both spend real money at two paid
// providers the moment they run. auth.ts already proves WHO is calling and
// that they own the child; it says nothing about HOW MUCH they can spend. A
// single compromised token, a runaway retry loop, or an over-eager parent
// could otherwise burn budget without limit — that gap is what this module
// closes.
//
// Two independent guards, both enforced by reserve_generation_attempt()
// (0008_generation_quota.sql) in a single advisory-locked round trip so two
// concurrent requests cannot both slip under a cap:
//   - a short rate-limit window per user, across every child they own;
//   - a month-to-date quota per child, mirroring the ~one-book/month rhythm
//     (VOLUME_SIZE = 10 in src/features/reader/volumes.ts, merged in PR #27,
//     and the client-side allowance on the still-gated paywall branch).
//
// There is no module shared between the Expo app and these Deno functions, so
// the "10" here is a second copy by necessity, not a shared constant — keep it
// in sync with VOLUME_SIZE by hand for now. Once the paywall branch merges,
// its allowance should probably read CHAPTER_MONTHLY_ALLOWANCE instead of
// restating the number a third time.
//
// The numbers themselves are Jai's call, not guessed here: every default
// below is a conservative placeholder pending real usage data, overridable
// via env (see .env.example) without a code change.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** Indirection so this pure-logic module can also be unit-tested under Jest, which has no `Deno` global. */
function readEnv(name: string): string | undefined {
  // deno-lint-ignore no-explicit-any
  const denoGlobal = (globalThis as any).Deno;
  return denoGlobal?.env?.get(name) as string | undefined;
}

export interface QuotaConfig {
  /** Generation calls a single user may start within `rateLimitWindowMs`. */
  rateLimitMax: number;
  rateLimitWindowMs: number;
  /** Chapters a single child may have generated in the current UTC month. */
  monthlyAllowance: number;
}

const DEFAULTS: QuotaConfig = {
  rateLimitMax: 3,
  rateLimitWindowMs: 60_000,
  monthlyAllowance: 10, // mirrors VOLUME_SIZE — see module comment above
};

function readPositiveInt(name: string, fallback: number): number {
  const raw = readEnv(name);
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function loadQuotaConfig(): QuotaConfig {
  return {
    rateLimitMax: readPositiveInt("GENERATION_RATE_LIMIT_MAX", DEFAULTS.rateLimitMax),
    rateLimitWindowMs: readPositiveInt(
      "GENERATION_RATE_LIMIT_WINDOW_MS",
      DEFAULTS.rateLimitWindowMs,
    ),
    monthlyAllowance: readPositiveInt(
      "CHAPTER_MONTHLY_ALLOWANCE",
      DEFAULTS.monthlyAllowance,
    ),
  };
}

export type QuotaReason = "rate_limited" | "monthly_quota_reached";

interface QuotaCheckResult {
  allowed: boolean;
  reason?: QuotaReason;
  resets_at?: string;
}

/**
 * Warm, bilingual copy for each block reason — the same kind of message the
 * family-facing allowance notice uses (a per-volume rhythm, not a
 * punishment), not a bare 429 body.
 */
const MESSAGES: Record<QuotaReason, { en: string; ko: string }> = {
  rate_limited: {
    en: "Let's slow down just a little — please wait a minute before asking "
      + "for another chapter.",
    ko: "잠깐 쉬어갈까요? 잠시 후 다시 새 이야기를 요청해 주세요.",
  },
  monthly_quota_reached: {
    en: "This month's book is already full of chapters — what a lot of "
      + "story! The next book starts next month.",
    ko: "이번 달 책이 이야기로 가득 찼어요! 다음 책은 다음 달에 시작돼요.",
  },
};

export class QuotaExceededError extends Error {
  readonly status = 429;
  constructor(readonly reason: QuotaReason, readonly resetsAt?: string) {
    super(`generation quota exceeded: ${reason}`);
    this.name = "QuotaExceededError";
  }

  toBody(): Record<string, unknown> {
    const copy = MESSAGES[this.reason];
    return {
      ok: false,
      error: copy.en,
      code: this.reason,
      message_en: copy.en,
      message_ko: copy.ko,
      ...(this.resetsAt ? { resets_at: this.resetsAt } : {}),
    };
  }
}

/**
 * Reserves a generation slot for this call, or throws QuotaExceededError.
 *
 * Must be called after assertOwnsChild and before anything that costs money
 * — the reservation IS the spend guard, not a report on one. `source`
 * distinguishes the on-demand path from the pre-generation queue purely for
 * observability; both draw from the same limits.
 */
export async function reserveGenerationSlot(
  supabase: SupabaseClient,
  params: { userId: string; childId: string; source: "generate-chapter" | "enqueue-chapter" },
): Promise<void> {
  const config = loadQuotaConfig();
  const { data, error } = await supabase.rpc("reserve_generation_attempt", {
    p_user_id: params.userId,
    p_child_id: params.childId,
    p_source: params.source,
    p_rate_limit_max: config.rateLimitMax,
    p_rate_window_ms: config.rateLimitWindowMs,
    p_monthly_allowance: config.monthlyAllowance,
  });
  if (error) {
    throw error;
  }

  const result = data as QuotaCheckResult;
  if (!result.allowed) {
    if (!result.reason) {
      throw new Error("reserve_generation_attempt blocked with no reason");
    }
    throw new QuotaExceededError(result.reason, result.resets_at);
  }
}

/** Builds the response for a QuotaExceededError, or null for any other error. */
export function quotaErrorResponse(
  err: unknown,
): { body: Record<string, unknown>; status: number } | null {
  if (!(err instanceof QuotaExceededError)) {
    return null;
  }
  return { body: err.toBody(), status: err.status };
}
