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

/** Locked reference image + descriptor. Reused for every render so faces never drift. */
export type VisualRef = {
  image_path: string;
  descriptor: string;
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
  character_ref: VisualRef | null;
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

export type Illustration = {
  page: number;
  image_path: string;
  prompt: string;
};

export type Chapter = {
  id: string;
  child_id: string;
  number: number;
  title: string | null;
  lesson: string | null;
  situation: string | null;
  body: string;
  summary: string;
  /** pgvector column. Not selected by the client — retrieval happens server-side. */
  embedding: number[] | null;
  illustrations: Illustration[] | null;
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
