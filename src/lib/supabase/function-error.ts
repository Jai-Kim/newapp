/**
 * supabase-js reports any non-2xx from an Edge Function as a
 * FunctionsHttpError whose `.message` is just "Edge Function returned a
 * non-2xx status code" — the useful part is the response body, which has to
 * be read off the attached Response.
 *
 * Shared by every client wrapper that needs to distinguish *why* a function
 * call failed rather than just that it did (e.g. lock-character's
 * `already_locked`, generate-chapter/enqueue-chapter's quota `code`).
 */
export async function bodyOf(error: unknown): Promise<Record<string, unknown> | null> {
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) {
    return null;
  }
  try {
    return (await context.clone().json()) as Record<string, unknown>;
  }
  catch {
    return null;
  }
}
