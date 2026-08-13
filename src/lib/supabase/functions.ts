import type { WorldItemType } from './types';

import { supabase } from './client';

/**
 * Client bindings for the Edge Functions in `supabase/functions/`.
 *
 * The app never talks to Anthropic or the image provider directly — every
 * provider key lives server-side (ARCHITECTURE §5).
 */

/** Matches `GenerateRequest` in supabase/functions/generate-chapter/index.ts. */
export type GenerateChapterRequest = {
  child_id: string;
  /** The value/situation the parent chose for tonight. */
  lesson: string;
  /** Optional free-text context ("first swim lesson tomorrow"). */
  situation?: string;
};

/** Story Bible delta — the contract in docs/prompts/story-generation.md. */
export type ChapterDelta = {
  new_characters: { name: string; role: string; traits: string }[];
  new_world: { name: string; type: WorldItemType; description: string }[];
  threads_opened: { summary: string }[];
  threads_resolved: { id: string; how: string }[];
  scenes: { page: number; description: string }[];
};

export type GeneratedChapter = {
  title: string;
  chapter_text: string;
  summary: string;
  delta: ChapterDelta;
};

export type GenerateChapterResponse = {
  ok: boolean;
  number: number;
  chapter: GeneratedChapter;
};

export async function generateChapter(
  body: GenerateChapterRequest,
): Promise<GenerateChapterResponse> {
  const { data, error } = await supabase.functions.invoke<GenerateChapterResponse>(
    'generate-chapter',
    { body },
  );

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('generate-chapter returned no data');
  }

  return data;
}

export type HealthCheckResponse = {
  ok: boolean;
  checks: {
    supabase: ProviderCheck;
    anthropic: ProviderCheck;
    image: ProviderCheck;
  };
};

export type ProviderCheck = {
  ok: boolean;
  detail: string;
  latency_ms?: number;
};

/** Spike 0 done-condition: proves the server layer can reach every provider. */
export async function healthCheck(): Promise<HealthCheckResponse> {
  const { data, error } = await supabase.functions.invoke<HealthCheckResponse>(
    'health-check',
    { body: {} },
  );

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('health-check returned no data');
  }

  return data;
}
