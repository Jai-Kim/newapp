/**
 * Story Bible row types — mirror of `supabase/schema.sql`.
 *
 * Hand-written for now. Once a Supabase project exists, these can be replaced
 * with generated types via:
 *   supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
 */

export type AgeBand = '3-4' | '5-6' | '7-8';
export type ThreadStatus = 'open' | 'resolved';
export type WorldItemType = 'place' | 'object' | 'lore';

/** Which language leads on the page. Both are always rendered (ADR-0001 §3). */
export type Language = 'en' | 'ko';

/** Locked reference image + descriptor. Reused for every render so faces never drift. */
export type VisualRef = {
  image_path: string;
  descriptor: string;
};

/**
 * A child's character reference, split so wardrobe can vary per scene while the
 * face cannot. Spike A found the image model over-preserves: given a locked
 * whole-character reference it kept the outfit even when the scene called for a
 * swimsuit. Separating the two is the fix (ADR-0001 §5).
 */
export type CharacterRef = {
  identity: VisualRef;
  wardrobe_default: string;
};

export type Family = {
  id: string;
  auth_user_id: string | null;
  display_name: string | null;
  created_at: string;
};

export type Child = {
  id: string;
  family_id: string;
  first_name: string;
  age_band: AgeBand;
  primary_language: Language;
  character_ref: CharacterRef | null;
  interests: string[] | null;
  created_at: string;
};

export type Character = {
  id: string;
  child_id: string;
  name: string;
  role: string | null;
  traits: string | null;
  visual_ref: VisualRef | null;
  first_appeared_chapter: number | null;
  created_at: string;
};

export type WorldItem = {
  id: string;
  child_id: string;
  name: string;
  type: WorldItemType | null;
  description: string | null;
  visual_ref: VisualRef | null;
  created_at: string;
};

/** Open narrative arcs & promises — the cross-night continuity engine. */
export type Thread = {
  id: string;
  child_id: string;
  summary: string;
  status: ThreadStatus;
  opened_chapter: number | null;
  resolved_chapter: number | null;
  created_at: string;
};

/**
 * One page of a chapter, in both languages. `en` and `ko` narrate the SAME
 * events so the two stay aligned in a dual-language book — they are composed
 * natively, not translated (ADR-0001 §2).
 */
export type ChapterPage = {
  page: number;
  en: string;
  ko: string;
  /** Scene description for the illustrator. */
  scene: string;
  /**
   * Clothing for this page only. Deliberately separate from the character's
   * locked identity, which never changes — this is what lets a scene put the
   * child in pyjamas or a swimsuit without the face drifting (ADR-0001 §5).
   */
  wardrobe: string;
  /** Filled in once the page has been illustrated. */
  image_path?: string;
};

export type Chapter = {
  id: string;
  child_id: string;
  number: number;
  title_en: string | null;
  title_ko: string | null;
  lesson: string | null;
  situation: string | null;
  pages: ChapterPage[];
  /** English canonical — drives retrieval and the embedding (ADR-0001 §4). */
  summary: string;
  /** pgvector column. Not selected by the client — retrieval happens server-side. */
  embedding: number[] | null;
  created_at: string;
};

export type LessonTaught = {
  id: string;
  child_id: string;
  lesson: string;
  chapter_id: string | null;
  created_at: string;
};

/** Shape consumed by `createClient<Database>` for typed queries. */
export type Database = {
  public: {
    Tables: {
      families: { Row: Family; Insert: Partial<Family>; Update: Partial<Family> };
      children: { Row: Child; Insert: Partial<Child>; Update: Partial<Child> };
      characters: { Row: Character; Insert: Partial<Character>; Update: Partial<Character> };
      world: { Row: WorldItem; Insert: Partial<WorldItem>; Update: Partial<WorldItem> };
      threads: { Row: Thread; Insert: Partial<Thread>; Update: Partial<Thread> };
      chapters: { Row: Chapter; Insert: Partial<Chapter>; Update: Partial<Chapter> };
      lessons_taught: {
        Row: LessonTaught;
        Insert: Partial<LessonTaught>;
        Update: Partial<LessonTaught>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
