/**
 * Story Bible row types — mirror of `supabase/migrations/0000_baseline.sql`.
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
  /** The companion's locked description, or null if the parent chose none. */
  companion?: string | null;
  /**
   * The parent's own answers in the look picker. Stored so the picker can
   * reopen on what they chose rather than making them rebuild their child from
   * memory — and so we can tell which descriptor wording produced a given sheet.
   */
  choices?: CharacterChoices;
  locked_at?: string;
  model?: string;
};

/**
 * What the guided picker sets. Values only — the prompt fragments they map to
 * live server-side in `supabase/functions/_shared/character.ts`, so the wording
 * that actually reaches the image model is never sent by a client.
 */
export type CharacterChoices = {
  presentation: 'girl' | 'boy' | 'child';
  skin_tone: string;
  hair_color: string;
  hair_texture: string;
  hair_style: string;
  fringe: string;
  eye_color: string;
  eye_shape: string;
  glasses: string;
  detail: string;
  signature_color: string;
  companion: string;
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
  /** Which version of the privacy notice the parent agreed to at setup (issue #12). Null before that consent step existed. */
  privacy_consent_version: string | null;
  /** When that consent was given. Null before that consent step existed. */
  privacy_consented_at: string | null;
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
  /**
   * Marked by the storyteller on ~4 pages — the emotional beats that carry a
   * full illustration. Not every page gets art: illustrations are ~70% of
   * marginal cost, and one-per-page loses money at any price (ADR-0002).
   */
  illustrated?: boolean;
  /** Filled in once the page has been illustrated. */
  image_path?: string;
};

/** Parent-preview gate. Nothing is child-readable until `approved`. */
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export type SafetyConcern = {
  page: number;
  language: 'en' | 'ko' | 'both';
  issue: string;
  severity: 'note' | 'concern' | 'blocking';
};

/** Content-filter verdict, written by generate-chapter before any parent sees it. */
export type SafetyVerdict = {
  verdict: 'safe' | 'blocked';
  concerns: SafetyConcern[];
  checked_languages: string[];
  model: string;
  latency_ms: number;
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
  safety: SafetyVerdict | null;
  review_status: ReviewStatus;
  reviewed_at: string | null;
  /**
   * Set when the family finishes reading. "Tonight's chapter" is the oldest
   * approved chapter with this still null, which is what lets the app open on
   * the right one instead of a library (issue #9).
   */
  read_at: string | null;
  created_at: string;
};

/**
 * The `child_readable_chapters` view: approved AND filter-passed only.
 *
 * Child-facing screens MUST read this, never `chapters` — the gate is encoded
 * in the view so a forgotten filter in app code cannot leak an unreviewed
 * chapter. Note it is fail-closed: a chapter with no safety verdict stays
 * invisible even if a parent approved it.
 */
export type ChildReadableChapter = Omit<
  Chapter,
  'embedding' | 'safety' | 'review_status'
>;

/** Pre-generation job state (issue #9). One live job per child at a time. */
export type QueueStatus = 'queued' | 'running' | 'done' | 'failed';

export type ChapterQueueJob = {
  id: string;
  child_id: string;
  lesson: string;
  situation: string | null;
  /** True when nobody chose, so the app can say so rather than pretend. */
  auto_chosen: boolean;
  status: QueueStatus;
  attempts: number;
  error: string | null;
  chapter_id: string | null;
  requested_by: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type LessonTaught = {
  id: string;
  child_id: string;
  lesson: string;
  chapter_id: string | null;
  created_at: string;
};

/**
 * postgrest-js requires every table entry to carry Insert/Update/Relationships,
 * and silently degrades the whole schema to `any` if one is missing — which
 * shows up much later as an RPC argument typed `never`.
 */
type Tbl<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

/** Shape consumed by `createClient<Database>` for typed queries. */
export type Database = {
  public: {
    Tables: {
      families: Tbl<Family>;
      children: Tbl<Child>;
      characters: Tbl<Character>;
      world: Tbl<WorldItem>;
      threads: Tbl<Thread>;
      chapters: Tbl<Chapter>;
      lessons_taught: Tbl<LessonTaught>;
      chapter_queue: Tbl<ChapterQueueJob>;
    };
    Views: {
      /** Gate-enforcing view — see ChildReadableChapter. */
      child_readable_chapters: { Row: ChildReadableChapter; Relationships: [] };
    };
    Functions: {
      /** Parent-gate write path; refuses to approve a filter-blocked chapter. */
      approve_chapter: {
        Args: { p_chapter_id: string; p_approved: boolean };
        Returns: Chapter;
      };
      /** Stamps read_at once; RLS decides ownership. */
      mark_chapter_read: {
        Args: { p_chapter_id: string };
        Returns: Chapter;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
