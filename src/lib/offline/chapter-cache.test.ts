import type { ChildReadableChapter } from '@/lib/supabase/types';

import { storage } from '@/lib/storage';

import {
  evictOldImages,
  isFullyOffline,
  KEEP_ILLUSTRATED,
  readCachedChapters,
  readIndex,
  resolveImageUris,
  writeCachedChapter,
} from './chapter-cache';

/**
 * Offline reading is a promise made at the worst possible moment to break it:
 * a dark bedroom, a tired parent, no signal. These cover the parts that decide
 * whether the promise holds.
 */

// jest.mock factories are hoisted, so anything they close over must be
// named `mock*` to be allowed through.
const mockBlobs = new Map<string, string>();

/**
 * jest-setup mocks react-native-mmkv globally with a no-op, so `storage` reads
 * back nothing and every assertion here would pass vacuously. An in-memory
 * store is what makes these tests test anything.
 */
const mockStore = new Map<string, string>();

jest.mock('@/lib/storage', () => ({
  storage: {
    getString: (key: string) => mockStore.get(key),
    set: (key: string, value: string) => mockStore.set(key, value),
    remove: (key: string) => mockStore.delete(key),
    clearAll: () => mockStore.clear(),
  },
}));

jest.mock('./blob-store', () => ({
  blobUri: async (key: string) => mockBlobs.get(key) ?? null,
  hasBlob: async (key: string) => mockBlobs.has(key),
  removeBlob: async (key: string) => {
    mockBlobs.delete(key);
  },
  putBlob: async (key: string) => {
    mockBlobs.set(key, `file:///${key}`);
    return `file:///${key}`;
  },
  clearBlobs: async () => mockBlobs.clear(),
}));

function chapter(number: number, images: (string | undefined)[]): ChildReadableChapter {
  return {
    id: `ch-${number}`,
    child_id: 'child-1',
    number,
    title_en: `Chapter ${number}`,
    title_ko: `${number}장`,
    lesson: null,
    situation: null,
    summary: 's',
    reviewed_at: null,
    read_at: null,
    created_at: '',
    pages: images.map((image_path, i) => ({
      page: i + 1,
      en: 'English',
      ko: '한국어',
      scene: '',
      wardrobe: '',
      ...(image_path === undefined ? {} : { image_path }),
    })),
  } as ChildReadableChapter;
}

function cache(number: number, images: (string | undefined)[]) {
  const entry = chapter(number, images);
  const stored = images.filter((p): p is string => p !== undefined);
  for (const path of stored) {
    mockBlobs.set(path, `file:///${path}`);
  }
  writeCachedChapter({ chapter: entry, images: stored, cachedAt: '' });
  return entry;
}

beforeEach(() => {
  storage.clearAll();
  mockBlobs.clear();
});

describe('resolveImageUris', () => {
  it('prefers the cached copy over a signed URL', async () => {
    const entry = cache(1, ['illustrations/child-1/ch1/p1.png']);

    const uris = await resolveImageUris(entry, {
      'illustrations/child-1/ch1/p1.png': 'https://signed.example/expiring',
    });

    // The signed URL expires in an hour; the file on disk does not.
    expect(uris['illustrations/child-1/ch1/p1.png']).toBe(
      'file:///illustrations/child-1/ch1/p1.png',
    );
  });

  it('falls back to the signed URL when nothing was downloaded', async () => {
    const entry = chapter(1, ['illustrations/child-1/ch1/p1.png']);

    const uris = await resolveImageUris(entry, {
      'illustrations/child-1/ch1/p1.png': 'https://signed.example/fresh',
    });

    expect(uris['illustrations/child-1/ch1/p1.png']).toBe('https://signed.example/fresh');
  });

  it('leaves an unavailable picture out rather than breaking the page', async () => {
    // Neither cached nor signable. A missing illustration must never stop a
    // chapter being read — text is the story, art is the decoration.
    const entry = chapter(1, ['illustrations/child-1/ch1/p1.png']);

    await expect(resolveImageUris(entry, {})).resolves.toEqual({});
  });

  it('ignores pages that never had art', async () => {
    const entry = chapter(1, [undefined, undefined]);
    await expect(resolveImageUris(entry, {})).resolves.toEqual({});
  });
});

describe('isFullyOffline', () => {
  it('is true only when every illustration is on the device', async () => {
    cache(1, ['a.png', 'b.png']);
    await expect(isFullyOffline('ch-1')).resolves.toBe(true);

    mockBlobs.delete('b.png');
    // Half the pictures means this is not airplane-mode ready, whatever the
    // library badge would like to claim.
    await expect(isFullyOffline('ch-1')).resolves.toBe(false);
  });

  it('is true for a text-only chapter with no art at all', async () => {
    cache(2, [undefined, undefined]);
    await expect(isFullyOffline('ch-2')).resolves.toBe(true);
  });

  it('is false for a chapter that was never cached', async () => {
    await expect(isFullyOffline('ch-nope')).resolves.toBe(false);
  });
});

describe('evictOldImages', () => {
  it('keeps recent chapters illustrated and strips the rest', async () => {
    for (let n = 1; n <= KEEP_ILLUSTRATED + 2; n++) {
      cache(n, [`ch${n}-p1.png`]);
    }

    const removed = await evictOldImages('child-1');

    // Two chapters past the window, one image each.
    expect(removed).toBe(2);
    expect(mockBlobs.has(`ch${KEEP_ILLUSTRATED + 2}-p1.png`)).toBe(true);
    expect(mockBlobs.has('ch1-p1.png')).toBe(false);
  });

  it('keeps the text of evicted chapters', async () => {
    for (let n = 1; n <= KEEP_ILLUSTRATED + 1; n++) {
      cache(n, [`ch${n}-p1.png`]);
    }
    await evictOldImages('child-1');

    // Text is kilobytes; a parent browsing offline should still see every
    // title even when the pictures have been reclaimed.
    const titles = readCachedChapters('child-1').map(c => c.title_en);
    expect(titles).toHaveLength(KEEP_ILLUSTRATED + 1);
    expect(await isFullyOffline('ch-1')).toBe(false);
  });
});

describe('the index', () => {
  it('lists the most recently cached chapter first', () => {
    cache(1, []);
    cache(2, []);
    expect(readIndex('child-1')).toEqual(['ch-2', 'ch-1']);
  });

  it('does not duplicate a chapter cached twice', () => {
    cache(1, []);
    cache(1, []);
    expect(readIndex('child-1')).toEqual(['ch-1']);
  });

  it('returns the offline shelf newest chapter first', () => {
    cache(1, []);
    cache(3, []);
    cache(2, []);
    expect(readCachedChapters('child-1').map(c => c.number)).toEqual([3, 2, 1]);
  });

  it('survives a corrupted entry instead of breaking bedtime', () => {
    cache(1, []);
    storage.set('offline:chapter:ch-1', '{ not json');

    // A half-written entry drops out; it must not throw on the way to a story.
    expect(() => readCachedChapters('child-1')).not.toThrow();
    expect(readCachedChapters('child-1')).toEqual([]);
  });
});
