/**
 * Turning an unknown throw into something a parent can read.
 *
 * `e instanceof Error ? e.message : String(e)` looks right and is wrong here:
 * supabase-js rejects with PostgrestError and StorageError, which are plain
 * objects carrying a `message` but not extending Error. String() on those
 * renders the literal text "[object Object]", which is what a parent saw when
 * a chapter failed to load.
 */
export function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null) {
    const { message } = error as { message?: unknown };
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Something went wrong.';
}
