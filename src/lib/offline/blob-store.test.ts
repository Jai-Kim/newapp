/**
 * The native binary cache.
 *
 * The E2E suite runs on web, so it exercises `blob-store.web.ts` and never
 * touches this file — yet native is where offline reading actually matters. A
 * phone is the whole point; Chrome is the test harness. These cover the parts
 * that would silently break a bedtime: writing to a directory that survives,
 * flattening a key that contains slashes, and reporting honestly whether a
 * picture is really on the device.
 *
 * They do not replace running it on a device, which is still outstanding.
 */

const mockFiles = new Map<string, Uint8Array>();
const mockDirs = new Set<string>();

jest.mock('expo-file-system', () => {
  class MockDirectory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts
        .map(part => (typeof part === 'string' ? part : part.uri))
        .join('/');
    }

    get exists() {
      return mockDirs.has(this.uri);
    }

    create() {
      mockDirs.add(this.uri);
    }

    delete() {
      mockDirs.delete(this.uri);
      for (const key of [...mockFiles.keys()]) {
        if (key.startsWith(this.uri)) {
          mockFiles.delete(key);
        }
      }
    }
  }

  class MockFile {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts
        .map(part => (typeof part === 'string' ? part : part.uri))
        .join('/');
    }

    get exists() {
      return mockFiles.has(this.uri);
    }

    create() {
      mockFiles.set(this.uri, new Uint8Array());
    }

    write(bytes: Uint8Array) {
      mockFiles.set(this.uri, bytes);
    }

    delete() {
      mockFiles.delete(this.uri);
    }
  }

  return {
    Directory: MockDirectory,
    File: MockFile,
    Paths: {
      // Distinguishable on purpose: one of the assertions below is that we
      // never write to the evictable one.
      document: { uri: 'file:///DOCUMENT' },
      cache: { uri: 'file:///CACHE' },
    },
  };
});

const PATH = 'illustrations/child-1/ch3/p1.png';

// Required after jest.mock so the mocked expo-file-system is in place first.
// eslint-disable-next-line ts/consistent-type-imports
const store: typeof import('./blob-store') = require('./blob-store');

beforeEach(() => {
  mockFiles.clear();
  mockDirs.clear();
});

describe('the native blob store', () => {
  it('round-trips bytes under a storage path', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const uri = await store.putBlob(PATH, bytes);

    expect(uri).toContain('DOCUMENT');
    await expect(store.hasBlob(PATH)).resolves.toBe(true);
    await expect(store.blobUri(PATH)).resolves.toBe(uri);
    expect(mockFiles.get(uri)).toEqual(bytes);
  });

  it('writes where the system will not evict it', async () => {
    const uri = await store.putBlob(PATH, new Uint8Array([1]));

    // Paths.cache can be reclaimed under storage pressure, and a chapter that
    // quietly stopped reading offline would fail at exactly the wrong moment.
    expect(uri).not.toContain('CACHE');
    expect(uri).toContain('DOCUMENT');
  });

  it('flattens the slashes in a storage path into one filename', async () => {
    const uri = await store.putBlob(PATH, new Uint8Array([1]));
    const filename = uri.split('/').pop() ?? '';

    // The key contains slashes. Left in, they would be read as nested
    // directories that were never created, and the write would fail.
    expect(filename).not.toContain('/');
    expect(filename).toBe('illustrations_child_1_ch3_p1_png.img');
    // Still traceable back to the page it came from, which matters when
    // looking at a device's storage and asking what any of it is.
    expect(filename).toContain('ch3_p1');
  });

  it('keeps two different pages apart', async () => {
    await store.putBlob('illustrations/c/ch1/p1.png', new Uint8Array([1]));
    await store.putBlob('illustrations/c/ch1/p2.png', new Uint8Array([2]));

    const first = await store.blobUri('illustrations/c/ch1/p1.png');
    const second = await store.blobUri('illustrations/c/ch1/p2.png');
    expect(first).not.toBe(second);
  });

  it('says null rather than a broken uri for a picture never downloaded', async () => {
    // The reader falls back to a signed URL on null; a uri pointing at nothing
    // would render as a permanently broken image instead.
    await expect(store.blobUri(PATH)).resolves.toBeNull();
    await expect(store.hasBlob(PATH)).resolves.toBe(false);
  });

  it('overwrites rather than failing when a page is downloaded twice', async () => {
    await store.putBlob(PATH, new Uint8Array([1]));
    const uri = await store.putBlob(PATH, new Uint8Array([2, 2]));

    expect(mockFiles.get(uri)).toEqual(new Uint8Array([2, 2]));
  });

  it('removes one picture without touching the others', async () => {
    await store.putBlob('a/1.png', new Uint8Array([1]));
    await store.putBlob('b/2.png', new Uint8Array([2]));

    await store.removeBlob('a/1.png');

    await expect(store.hasBlob('a/1.png')).resolves.toBe(false);
    await expect(store.hasBlob('b/2.png')).resolves.toBe(true);
  });

  it('does not throw when removing something that was never there', async () => {
    // Eviction runs over a list that may already be stale.
    await expect(store.removeBlob('never/here.png')).resolves.toBeUndefined();
  });
});
