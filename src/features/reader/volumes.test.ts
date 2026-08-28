import type { ChildReadableChapter } from '@/lib/supabase/types';

import { currentVolume, groupIntoVolumes, VOLUME_SIZE } from './volumes';

function chapter(number: number): ChildReadableChapter {
  return {
    id: `ch-${number}`,
    child_id: 'child-1',
    number,
    title_en: `Chapter ${number}`,
    title_ko: `챕터 ${number}`,
    lesson: null,
    situation: null,
    pages: [],
    summary: '',
    reviewed_at: null,
    read_at: null,
    created_at: '',
  };
}

describe('groupIntoVolumes', () => {
  it('is empty for no chapters', () => {
    expect(groupIntoVolumes([])).toEqual([]);
  });

  it('puts fewer than 10 chapters into one incomplete volume', () => {
    const volumes = groupIntoVolumes([1, 2, 3, 4, 5].map(chapter));

    expect(volumes).toHaveLength(1);
    expect(volumes[0].index).toBe(1);
    expect(volumes[0].complete).toBe(false);
    expect(volumes[0].chapters).toHaveLength(5);
  });

  it('marks a volume complete at exactly 10 chapters', () => {
    const volumes = groupIntoVolumes(
      Array.from({ length: VOLUME_SIZE }, (_, i) => chapter(i + 1)),
    );

    expect(volumes).toHaveLength(1);
    expect(volumes[0].complete).toBe(true);
    expect(volumes[0].chapters).toHaveLength(10);
  });

  it('starts a second, incomplete volume once the first is full', () => {
    const volumes = groupIntoVolumes(
      Array.from({ length: 13 }, (_, i) => chapter(i + 1)),
    );

    expect(volumes).toHaveLength(2);
    expect(volumes[0].complete).toBe(true);
    expect(volumes[0].chapters).toHaveLength(10);
    expect(volumes[1].index).toBe(2);
    expect(volumes[1].complete).toBe(false);
    expect(volumes[1].chapters).toHaveLength(3);
  });

  it('groups by position in the readable sequence, not by chapter.number', () => {
    // A rejected chapter can leave a gap in `number` (e.g. 4 was rejected) —
    // the readable list only ever contains what actually made it through.
    const numbers = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12];
    const volumes = groupIntoVolumes(numbers.map(chapter));

    expect(volumes).toHaveLength(2);
    expect(volumes[0].complete).toBe(true);
    expect(volumes[0].chapters.map(c => c.number)).toEqual([1, 2, 3, 5, 6, 7, 8, 9, 10, 11]);
    expect(volumes[1].chapters.map(c => c.number)).toEqual([12]);
  });

  it('sorts out-of-order input before grouping', () => {
    const shuffled = [3, 1, 5, 2, 4].map(chapter);
    const volumes = groupIntoVolumes(shuffled);

    expect(volumes[0].chapters.map(c => c.number)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('currentVolume', () => {
  it('is null with no chapters', () => {
    expect(currentVolume([])).toBeNull();
  });

  it('is the only volume while under 10 chapters', () => {
    const volume = currentVolume([1, 2, 3].map(chapter));
    expect(volume?.index).toBe(1);
    expect(volume?.complete).toBe(false);
  });

  it('stays on the completed volume until an 11th chapter arrives', () => {
    const volume = currentVolume(
      Array.from({ length: VOLUME_SIZE }, (_, i) => chapter(i + 1)),
    );
    expect(volume?.index).toBe(1);
    expect(volume?.complete).toBe(true);
  });

  it('moves to the new volume once it starts filling', () => {
    const volume = currentVolume(
      Array.from({ length: 11 }, (_, i) => chapter(i + 1)),
    );
    expect(volume?.index).toBe(2);
    expect(volume?.complete).toBe(false);
    expect(volume?.chapters).toHaveLength(1);
  });
});
