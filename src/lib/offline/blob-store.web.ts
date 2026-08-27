/**
 * Binary cache for illustrations — web.
 *
 * `expo-file-system` is a no-op stub on web: it warns and returns nothing, so
 * the native module cannot be shared. The Cache API is the right equivalent —
 * real binary storage, origin-scoped, survives reload, and unlike localStorage
 * it is not capped at a few megabytes.
 *
 * Web is a development and test surface rather than a shipping target, but it
 * is where the E2E suite runs, so a real implementation here is what makes the
 * offline behaviour testable at all. See blob-store.ts for the reasoning about
 * cache keys, which applies identically.
 */

const CACHE_NAME = 'storyloom-offline-illustrations-v1';

/** Cache API keys must be URLs; synthesise a stable one from the storage path. */
function requestFor(key: string): string {
  return `https://offline.storyloom.invalid/${encodeURIComponent(key)}`;
}

async function store(): Promise<Cache | null> {
  if (typeof caches === 'undefined') {
    return null;
  }
  try {
    return await caches.open(CACHE_NAME);
  }
  catch {
    // Private windows and some embedded browsers refuse; a missing cache means
    // reading online still works, so this must degrade rather than throw.
    return null;
  }
}

export async function putBlob(key: string, bytes: Uint8Array): Promise<string> {
  const cache = await store();
  if (!cache) {
    throw new Error('this browser has no Cache API; images cannot be saved offline');
  }
  // Copy into a fresh buffer: a Uint8Array view over a larger ArrayBuffer
  // would otherwise be stored in full.
  const body = bytes.slice().buffer as ArrayBuffer;
  await cache.put(
    requestFor(key),
    new Response(body, { headers: { 'Content-Type': 'image/png' } }),
  );
  return (await blobUri(key)) ?? '';
}

export async function blobUri(key: string): Promise<string | null> {
  const cache = await store();
  const hit = await cache?.match(requestFor(key));
  if (!hit) {
    return null;
  }
  // A blob: URL is what an <img> can actually render. These live until the
  // page unloads, and the reader asks for fresh ones each time it opens.
  return URL.createObjectURL(await hit.blob());
}

export async function hasBlob(key: string): Promise<boolean> {
  const cache = await store();
  return (await cache?.match(requestFor(key))) !== undefined;
}

export async function removeBlob(key: string): Promise<void> {
  const cache = await store();
  await cache?.delete(requestFor(key));
}

export async function clearBlobs(): Promise<void> {
  if (typeof caches !== 'undefined') {
    await caches.delete(CACHE_NAME);
  }
}
