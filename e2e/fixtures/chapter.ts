/**
 * The deterministic chapter used in stub mode.
 *
 * Written to be checkable rather than pretty. Every page carries real English
 * and real Korean — not lorem, not the same string twice — because the
 * assertion that matters is that both languages survive the whole path from
 * the database to two lines of text on a page. A fixture whose `ko` was ASCII
 * would pass a "not empty" check while hiding an encoding bug.
 *
 * Four pages are marked `illustrated`, matching ADR-0002.
 */

export type FixturePage = {
  page: number;
  en: string;
  ko: string;
  scene: string;
  wardrobe: string;
  illustrated: boolean;
};

export const FIXTURE_TITLE_EN = 'The Lantern on the Quiet Bridge';
export const FIXTURE_TITLE_KO = '조용한 다리 위의 등불';

export const FIXTURE_PAGES: FixturePage[] = [
  {
    page: 1,
    en: 'The evening came in slowly, the way it does when nobody is in a hurry.',
    ko: '저녁은 아무도 서두르지 않을 때처럼 천천히 찾아왔어요.',
    scene: 'A small child on a wooden bridge at dusk, warm sky behind.',
    wardrobe: 'a terracotta cardigan and soft boots',
    illustrated: true,
  },
  {
    page: 2,
    en: 'On the bridge there was a lantern that had gone out, and nobody knew why.',
    ko: '다리 위에는 꺼져 버린 등불이 하나 있었는데, 아무도 이유를 몰랐어요.',
    scene: 'A dark paper lantern hanging from the bridge rail.',
    wardrobe: 'a terracotta cardigan and soft boots',
    illustrated: false,
  },
  {
    page: 3,
    en: 'The first try did not work. Neither did the second.',
    ko: '첫 번째 시도는 잘되지 않았어요. 두 번째도 마찬가지였고요.',
    scene: 'The child kneeling beside the lantern, brow furrowed.',
    wardrobe: 'a terracotta cardigan, sleeves pushed up',
    illustrated: true,
  },
  {
    page: 4,
    en: 'So they sat down, and thought about it, and did not give up.',
    ko: '그래서 자리에 앉아 곰곰이 생각했고, 포기하지 않았어요.',
    scene: 'The child sitting cross-legged, chin in hands, thinking.',
    wardrobe: 'a terracotta cardigan and soft boots',
    illustrated: true,
  },
  {
    page: 5,
    en: 'On the third try, the small flame caught and held.',
    ko: '세 번째 시도에서 작은 불꽃이 붙어 계속 타올랐어요.',
    scene: 'A warm glow spreading from the lantern across the bridge.',
    wardrobe: 'a terracotta cardigan and soft boots',
    illustrated: false,
  },
  {
    page: 6,
    en: 'And the quiet bridge was not dark any more. Goodnight.',
    ko: '그리고 조용한 다리는 더 이상 어둡지 않았어요. 잘 자요.',
    scene: 'The lit bridge from a distance, stars beginning to show.',
    wardrobe: 'a terracotta cardigan and soft boots',
    illustrated: true,
  },
];

export const FIXTURE_SUMMARY
  = 'On a bridge at dusk, the child finds a lantern that has gone out and, after '
    + 'two failed attempts, sits down to think rather than giving up. The third '
    + 'try works.';

export const FIXTURE_LESSON = 'trying again after something goes wrong';

/** Which pages the reader should be able to show art on. */
export const ILLUSTRATED_PAGES = FIXTURE_PAGES.filter(p => p.illustrated).map(p => p.page);

/**
 * A 1x1 PNG. Size is irrelevant — the assertion is that the reader resolved a
 * signed URL and put an image on the page, not what the picture is of.
 */
export const FIXTURE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
