import type { Chapter, ChildReadableChapter } from './types';

import { supabase } from './client';

/**
 * Chapter queries for the app.
 *
 * Two rules encoded here rather than left to callers:
 *   - the review queue reads `chapters`, because a parent must see what is
 *     waiting and why;
 *   - the reader reads `child_readable_chapters`, never `chapters`, so an
 *     unapproved or filter-blocked chapter cannot reach a child even if this
 *     file is called wrongly (Spike D).
 */

export type ChapterSummary = Pick<
  Chapter,
  'id' | 'number' | 'title_en' | 'title_ko' | 'summary' | 'review_status' | 'created_at'
> & { has_art: boolean; concern_count: number };

const SUMMARY_COLUMNS
  = 'id,number,title_en,title_ko,summary,review_status,created_at,pages,safety';

type SummaryRow = Omit<ChapterSummary, 'has_art' | 'concern_count'> & {
  pages: { image_path?: string }[];
  safety: { concerns?: unknown[] } | null;
};

function toSummary(row: SummaryRow): ChapterSummary {
  const { pages, safety, ...rest } = row;
  return {
    ...rest,
    has_art: (pages ?? []).some(p => p.image_path),
    concern_count: safety?.concerns?.length ?? 0,
  };
}

/** Chapters waiting on a parent. Oldest first — the queue is a to-do list. */
export async function listPendingChapters(childId: string): Promise<ChapterSummary[]> {
  const { data, error } = await supabase
    .from('chapters')
    .select(SUMMARY_COLUMNS)
    .eq('child_id', childId)
    .eq('review_status', 'pending')
    .order('number', { ascending: true });

  if (error) {
    throw error;
  }
  return (data as SummaryRow[]).map(toSummary);
}

/** Everything a parent has ever been shown, for the review history. */
export async function listAllChapters(childId: string): Promise<ChapterSummary[]> {
  const { data, error } = await supabase
    .from('chapters')
    .select(SUMMARY_COLUMNS)
    .eq('child_id', childId)
    .order('number', { ascending: false });

  if (error) {
    throw error;
  }
  return (data as SummaryRow[]).map(toSummary);
}

/** Full chapter including safety notes — the parent review view. */
export async function getChapterForReview(chapterId: string): Promise<Chapter> {
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('id', chapterId)
    .single();

  if (error) {
    throw error;
  }
  return data as Chapter;
}

/**
 * The child-facing library. Reads the gate-enforcing view, so this cannot
 * return anything unapproved or filter-blocked.
 */
export async function listReadableChapters(childId: string): Promise<ChildReadableChapter[]> {
  const { data, error } = await supabase
    .from('child_readable_chapters')
    .select('*')
    .eq('child_id', childId)
    .order('number', { ascending: false });

  if (error) {
    throw error;
  }
  return data as ChildReadableChapter[];
}

export async function getReadableChapter(chapterId: string): Promise<ChildReadableChapter> {
  const { data, error } = await supabase
    .from('child_readable_chapters')
    .select('*')
    .eq('id', chapterId)
    .single();

  if (error) {
    throw error;
  }
  return data as ChildReadableChapter;
}

/**
 * The gate's write path. Goes through the DB function rather than a direct
 * update so the "a blocked chapter can never be approved" rule lives next to
 * the data instead of in the client.
 */
export async function setChapterApproval(
  chapterId: string,
  approved: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('approve_chapter', {
    p_chapter_id: chapterId,
    p_approved: approved,
  });
  if (error) {
    throw error;
  }
}

/**
 * Illustrations live in a private bucket, so the app needs a short-lived signed
 * URL per image. Returns a map keyed by the stored path.
 */
export async function signImagePaths(
  paths: string[],
  expiresInSeconds = 60 * 60,
): Promise<Record<string, string>> {
  const wanted = [...new Set(paths.filter(Boolean))];
  if (wanted.length === 0) {
    return {};
  }

  // All illustration paths share one bucket; strip the prefix for the API.
  const bucket = 'illustrations';
  const keys = wanted.map(p => p.replace(`${bucket}/`, ''));

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(keys, expiresInSeconds);

  if (error) {
    throw error;
  }

  const out: Record<string, string> = {};
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) {
      out[`${bucket}/${entry.path}`] = entry.signedUrl;
    }
  }
  return out;
}

export type ChildRow = { id: string; first_name: string; primary_language: 'en' | 'ko' };

export async function listChildren(): Promise<ChildRow[]> {
  const { data, error } = await supabase
    .from('children')
    .select('id,first_name,primary_language')
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }
  return data as ChildRow[];
}

export async function getChild(childId: string): Promise<ChildRow> {
  const { data, error } = await supabase
    .from('children')
    .select('id,first_name,primary_language')
    .eq('id', childId)
    .single();

  if (error) {
    throw error;
  }
  return data as ChildRow;
}
