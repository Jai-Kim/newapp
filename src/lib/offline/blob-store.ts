import { Directory, File, Paths } from 'expo-file-system';

/**
 * Binary cache for illustrations — native.
 *
 * Images cannot live in MMKV. On web that is localStorage, capped at a few
 * megabytes for the whole origin; on native MMKV is memory-mapped, so a
 * handful of page illustrations would sit permanently in the app's memory.
 * They belong on disk, keyed by something stable.
 *
 * "Stable" is the whole problem. Supabase serves private objects through
 * signed URLs that expire in an hour and differ on every signing, so the URL
 * is useless as a cache key — which is also why expo-image's own disk cache
 * cannot carry this: `Image.prefetch` keys on the URL, and the URL we
 * prefetched will never be requested again. The storage path
 * (`illustrations/<child>/ch3/p1.png`) is the identity that persists, so it is
 * what we key on and why we own the bytes ourselves.
 *
 * `Paths.document`, not `Paths.cache`: the system may evict the cache
 * directory when storage runs low, and a chapter that quietly stopped being
 * readable offline would fail at exactly the moment it was needed.
 */

const ROOT = 'offline-illustrations';

/** Storage paths contain slashes; flatten them into one legal filename. */
function fileNameFor(key: string): string {
  return `${key.replace(/[^a-z0-9]/gi, '_')}.img`;
}

function root(): Directory {
  const dir = new Directory(Paths.document, ROOT);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

function fileFor(key: string): File {
  return new File(root(), fileNameFor(key));
}

export async function putBlob(key: string, bytes: Uint8Array): Promise<string> {
  const file = fileFor(key);
  file.create({ overwrite: true, intermediates: true });
  file.write(bytes);
  return file.uri;
}

/** A URI expo-image can render, or null if this image was never downloaded. */
export async function blobUri(key: string): Promise<string | null> {
  const file = fileFor(key);
  return file.exists ? file.uri : null;
}

export async function hasBlob(key: string): Promise<boolean> {
  return fileFor(key).exists;
}

export async function removeBlob(key: string): Promise<void> {
  const file = fileFor(key);
  if (file.exists) {
    file.delete();
  }
}

export async function clearBlobs(): Promise<void> {
  const dir = new Directory(Paths.document, ROOT);
  if (dir.exists) {
    dir.delete();
  }
}
