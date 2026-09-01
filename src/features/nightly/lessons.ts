/**
 * Everyday and age-neutral. `value` mirrors the server's fallback list
 * (`FALLBACK_LESSONS` in `supabase/functions/_shared/lessons.ts`) byte for
 * byte — it is what actually reaches `generate-chapter` via `onChoose`, and
 * what `testID` is derived from, so it must never be translated. `ko` is a
 * display-only label shown beside it and is never sent anywhere.
 */
export const LESSONS: { value: string; ko: string }[] = [
  { value: 'trying again after something goes wrong', ko: '실수해도 다시 도전하기' },
  { value: 'sharing something you don\'t want to share', ko: '나누고 싶지 않은 걸 나누기' },
  { value: 'being brave about something new', ko: '새로운 일에 용기 내기' },
  { value: 'saying sorry and meaning it', ko: '진심으로 미안하다고 말하기' },
  { value: 'noticing when someone else is sad', ko: '다른 사람의 슬픔 알아차리기' },
  { value: 'waiting for your turn', ko: '차례를 기다리기' },
  { value: 'telling the truth when it\'s hard', ko: '힘들어도 사실대로 말하기' },
  { value: 'asking for help', ko: '도움을 요청하기' },
  { value: 'being kind to someone left out', ko: '외로운 친구에게 다정하게 대하기' },
  { value: 'finishing something you started', ko: '시작한 일을 끝까지 해내기' },
];
