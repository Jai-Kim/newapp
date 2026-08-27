import type { ChapterQueueJob, ChildReadableChapter } from './types';

import { messageOf } from '@/lib/errors';

import { supabase } from './client';

/**
 * The nightly loop (issue #9).
 *
 * A chapter takes ~93s to write plus ~9s per illustration, which is far too
 * long to stand in front of at bedtime. So the app never generates on the
 * bedtime path: the parent chooses what TOMORROW is about at the end of
 * tonight's read, and by the next evening the chapter is written, illustrated
 * and already through the parent gate.
 *
 * That reordering is the whole design. You cannot pre-generate a chapter whose
 * subject is chosen at the moment it is wanted.
 */

/** What the home screen is showing tonight. */
export type NightlyState
  /** A chapter is approved and unread — the good case, and instant. */
  = | { kind: 'ready'; chapter: ChildReadableChapter }
  /** Written, but a grown-up hasn't read it yet. The gate moved to daytime. */
    | { kind: 'awaiting_review'; chapterId: string; title: string }
  /** Being written right now. */
    | { kind: 'writing'; job: ChapterQueueJob }
  /** Generation gave up. The parent is owed an explanation, not a spinner. */
    | { kind: 'failed'; job: ChapterQueueJob }
  /** Nothing queued and nothing waiting — offer to start one. */
    | { kind: 'empty' };

/** The oldest approved chapter nobody has read yet. */
export async function getTonightsChapter(
  childId: string,
): Promise<ChildReadableChapter | null> {
  const { data, error } = await supabase
    .from('child_readable_chapters')
    .select('*')
    .eq('child_id', childId)
    .is('read_at', null)
    .order('number', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return (data as ChildReadableChapter) ?? null;
}

/** The live job for this child, if any. At most one exists by construction. */
export async function getActiveJob(childId: string): Promise<ChapterQueueJob | null> {
  const { data, error } = await supabase
    .from('chapter_queue')
    .select('*')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return (data as ChapterQueueJob) ?? null;
}

/**
 * Resolves what to show tonight, in priority order: a chapter ready to read
 * beats one waiting on review, which beats a job still running.
 */
export async function getNightlyState(childId: string): Promise<NightlyState> {
  const ready = await getTonightsChapter(childId);
  if (ready) {
    return { kind: 'ready', chapter: ready };
  }

  const job = await getActiveJob(childId);

  if (job?.status === 'queued' || job?.status === 'running') {
    return { kind: 'writing', job };
  }

  // Generated but not yet approved. Read from `chapters`, not the view — the
  // whole point is that this one is NOT child-readable yet.
  const { data: pending } = await supabase
    .from('chapters')
    .select('id,title_en,title_ko')
    .eq('child_id', childId)
    .eq('review_status', 'pending')
    .order('number', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (pending) {
    return {
      kind: 'awaiting_review',
      chapterId: pending.id as string,
      title: (pending.title_en as string) ?? 'Tonight’s chapter',
    };
  }

  if (job?.status === 'failed') {
    return { kind: 'failed', job };
  }
  return { kind: 'empty' };
}

/**
 * Queues tomorrow's chapter and returns immediately — the Edge Function hands
 * the actual ~93s of work to a background task rather than making the caller
 * hold the connection open.
 *
 * Omitting `lesson` means "you choose": the server picks one the child hasn't
 * had lately and marks the job auto_chosen, so the app can say so.
 */
export async function enqueueTomorrow(
  childId: string,
  lesson?: string,
  situation?: string,
): Promise<{ ok: boolean; already_queued?: boolean; lesson?: string }> {
  const { data, error } = await supabase.functions.invoke(
    'enqueue-chapter',
    { body: { action: 'enqueue', child_id: childId, lesson, situation } },
  );

  if (error) {
    throw error;
  }
  return data as { ok: boolean; already_queued?: boolean; lesson?: string };
}

/**
 * Revives jobs a dead worker left behind. Called when the app opens: an Edge
 * Function that hit its wall-clock limit mid-generation would otherwise hold
 * the one-live-job lock forever, and the family would just never get a chapter.
 */
export async function sweepQueue(childId: string): Promise<number> {
  const { data, error } = await supabase.functions.invoke(
    'enqueue-chapter',
    { body: { action: 'sweep', child_id: childId } },
  );

  if (error) {
    // A failed sweep is housekeeping, not something to interrupt bedtime over
    // — but swallowing it silently means a queue that has stopped healing
    // looks identical to one that never needed to, which cost real time to
    // diagnose once already.
    console.warn('[nightly] sweep failed:', messageOf(error));
    return 0;
  }
  return (data as { revived?: number }).revived ?? 0;
}

/** Stamps read_at once, through the DB function so RLS decides ownership. */
export async function markChapterRead(chapterId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_chapter_read', {
    p_chapter_id: chapterId,
  });
  if (error) {
    throw error;
  }
}
