import type { ChildReadableChapter } from '@/lib/supabase/types';

import { currentVolume, groupIntoVolumes, VOLUME_SIZE } from './volumes';

function chapter(number: number): ChildReadableChapter {
  return {
    id: `ch-${number}`,
    child_id: 'child-1',
    number,
    title_en: `Chapter ${number}`,
    title_ko: `${number}장`,
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
  it('returns nothing for an empty library', () => {
    expect(groupIntoVolumes([])).toEqual([]);
  });

  it('groups the first ten chapters into one complete volume', () => {
    const chapters = Array.from({ length: VOLUME_SIZE }, (_, i) => chapter(i + 1));
    const volumes = groupIntoVolumes(chapters);

    expect(volumes).toHaveLength(1);
    expect(volumes[0].index).toBe(1);
    expect(volumes[0].complete).toBe(true);
    expect(volumes[0].chapters).toHaveLength(VOLUME_SIZE);
  });

  it('starts a second volume once the first is full', () => {
    const chapters = Array.from({ length: 11 }, (_, i) => chapter(i + 1));
    const volumes = groupIntoVolumes(chapters);

    expect(volumes).toHaveLength(2);
    expect(volumes[0].complete).toBe(true);
    expect(volumes[1].complete).toBe(false);
    expect(volumes[1].chapters).toHaveLength(1);
  });

  it('groups by position in the readable sequence, not raw chapter number', () => {
    // A parent rejected chapter 4, so the readable numbers skip it. Position
    // in the readable sequence must still fill the volume at ten items, or a
    // rejection would leave this family's first book permanently at 9 of 10.
    const numbers = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12];
    const chapters = numbers.map(chapter);
    const volumes = groupIntoVolumes(chapters);

    expect(volumes).toHaveLength(2);
    expect(volumes[0].complete).toBe(true);
    expect(volumes[0].chapters.map(c => c.number)).toEqual([1, 2, 3, 5, 6, 7, 8, 9, 10, 11]);
    expect(volumes[1].chapters.map(c => c.number)).toEqual([12]);
  });

  it('sorts out-of-order input before grouping', () => {
    const chapters = [chapter(3), chapter(1), chapter(2)];
    const volumes = groupIntoVolumes(chapters);

    expect(volumes[0].chapters.map(c => c.number)).toEqual([1, 2, 3]);
  });
});

describe('currentVolume', () => {
  it('is null for a library with nothing readable yet', () => {
    expect(currentVolume([])).toBeNull();
  });

  it('is the volume being filled', () => {
    const chapters = Array.from({ length: 4 }, (_, i) => chapter(i + 1));
    const volume = currentVolume(chapters);

    expect(volume?.index).toBe(1);
    expect(volume?.complete).toBe(false);
    expect(volume?.chapters).toHaveLength(4);
  });

  it('stays on the completed volume right at ten, and moves on at eleven', () => {
    const ten = Array.from({ length: 10 }, (_, i) => chapter(i + 1));
    expect(currentVolume(ten)?.complete).toBe(true);
    expect(currentVolume(ten)?.index).toBe(1);

    const eleven = Array.from({ length: 11 }, (_, i) => chapter(i + 1));
    expect(currentVolume(eleven)?.complete).toBe(false);
    expect(currentVolume(eleven)?.index).toBe(2);
  });
});
