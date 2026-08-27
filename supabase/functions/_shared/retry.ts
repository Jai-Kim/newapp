// Storyloom — retrying a provider call that failed for reasons of its own.
//
// Chapter generation already gets three attempts, spread across sweeps of the
// queue (see queue.ts). Locking a character sheet had none: a parent who
// tapped "Draw them" while Gemini was busy got the raw text of a 503 and no
// character. That is not a rare edge — Gemini returned "high demand" twice
// during this project's own spikes, and once in the first live E2E run.
//
// The distinction that matters is transient versus permanent. A 503 is the
// provider having a bad minute and is worth another go; a 400 is a prompt the
// provider will refuse just as firmly the third time, and retrying it only
// spends money and makes the parent wait longer to see the same failure.

/** Attempts, not retries: 3 means one try plus two more. Matches queue.ts. */
export const MAX_PROVIDER_ATTEMPTS = 3;

const TRANSIENT = /\b(408|429|500|502|503|504)\b|high demand|UNAVAILABLE|overloaded|internal error|temporarily|timeout|ECONNRESET|network/i;

export function isTransientProviderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return TRANSIENT.test(message);
}

export interface RetryOptions {
  attempts?: number;
  /** First backoff, doubled each time. Image generation is slow anyway. */
  baseDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
  label?: string;
}

/**
 * Runs `work`, retrying only what is worth retrying.
 *
 * Rethrows the LAST error rather than a wrapper, so the caller still sees what
 * the provider actually said — the point is to try again, not to hide why.
 */
export async function withRetry<T>(
  work: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    attempts = MAX_PROVIDER_ATTEMPTS,
    baseDelayMs = 2000,
    isRetryable = isTransientProviderError,
    label = "provider call",
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await work();
    }
    catch (error) {
      lastError = error;
      if (attempt === attempts || !isRetryable(error)) {
        throw error;
      }
      const delay = baseDelayMs * 2 ** (attempt - 1);
      console.warn(
        `${label}: attempt ${attempt}/${attempts} failed, retrying in ${delay}ms — `
        + `${error instanceof Error ? error.message : String(error)}`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * What to show a parent when it still failed.
 *
 * They cannot act on "503 UNAVAILABLE", and it reads like their fault or a
 * broken app. Say what happened, that nothing was lost, and what to do.
 */
export function friendlyProviderMessage(error: unknown): string {
  if (isTransientProviderError(error)) {
    return "The illustrator is busy right now. Nothing was saved and nothing "
      + "was charged — please try again in a minute.";
  }
  return "Something went wrong while drawing. Nothing was saved — please try "
    + "again, and if it keeps happening let us know.";
}
