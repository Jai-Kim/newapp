// Storyloom — crisis resource directory (issue #13).
//
// Kept as its own data-only module, deliberately separate from the
// classification logic in crisis.ts/crisis-response.ts, so a wrong phone
// number or a missing region can be corrected without touching anything that
// decides *when* a family sees this list.
//
// TODO(Jai): confirm every number below is current, and add any other region
// you want covered (this only has Korea and the US). None of these have been
// called to verify; they are sourced from public knowledge, not confirmed
// today's-date-accurate.

export interface CrisisResource {
  region: "kr" | "us";
  name_en: string;
  name_ko: string;
  /** What a parent actually dials or texts. */
  contact: string;
  note_en: string;
  note_ko: string;
}

export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    region: "kr",
    name_en: "Suicide Prevention Counseling Center (Korea)",
    name_ko: "자살예방상담전화",
    contact: "109",
    note_en: "Free, 24/7, from any phone in Korea.",
    note_ko: "24시간 무료 상담, 한국 내 어디서나 이용 가능해요.",
  },
  {
    region: "kr",
    name_en: "Child Abuse Report Line (Korea)",
    name_ko: "아동학대 신고",
    contact: "112",
    note_en: "Korea's police emergency line — also used to report suspected child abuse.",
    note_ko: "한국 경찰 신고 전화예요 — 아동학대가 의심될 때도 이용할 수 있어요.",
  },
  {
    region: "us",
    name_en: "988 Suicide & Crisis Lifeline (US)",
    name_ko: "988 자살 및 위기 상담전화 (미국)",
    contact: "988",
    note_en: "Free, 24/7, call or text, anywhere in the US.",
    note_ko: "24시간 무료, 전화 또는 문자, 미국 전역에서 이용 가능해요.",
  },
];
