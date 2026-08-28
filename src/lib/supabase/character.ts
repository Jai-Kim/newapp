import type { CharacterChoices, CharacterRef } from './types';

import { supabase } from './client';
import { bodyOf } from './function-error';

/**
 * The child's locked look.
 *
 * The picker sends option *values* and nothing else. The prompt is composed
 * server-side, drawn, reviewed and stored by the `lock-character` function —
 * the app never sees a Gemini key and never gets to write descriptor text
 * (ARCHITECTURE §5).
 */

export type LockCharacterResponse = {
  ok: boolean;
  child_id: string;
  image_path: string;
  /** Short-lived URL so the parent can see the sheet the moment it exists. */
  preview_url: string | null;
  descriptor: string;
  wardrobe_default: string;
  latency_ms: number;
  model: string;
};

/** Thrown when a sheet already exists — carries what a re-lock would cost. */
export class AlreadyLockedError extends Error {
  constructor(readonly illustratedPages: number) {
    super('This child already has a character sheet.');
    this.name = 'AlreadyLockedError';
  }
}

export async function lockCharacter(
  childId: string,
  choices: CharacterChoices,
  options: { relock?: boolean } = {},
): Promise<LockCharacterResponse> {
  const { data, error } = await supabase.functions.invoke<LockCharacterResponse>(
    'lock-character',
    { body: { child_id: childId, choices, relock: options.relock ?? false } },
  );

  if (error) {
    const body = await bodyOf(error);
    if (body?.already_locked === true) {
      throw new AlreadyLockedError(Number(body.illustrated_pages ?? 0));
    }
    throw new Error(
      typeof body?.error === 'string' ? body.error : error.message,
    );
  }
  if (!data) {
    throw new Error('lock-character returned no data');
  }
  return data;
}

/** The stored sheet, or null before the parent has locked one. */
export async function getCharacterRef(childId: string): Promise<CharacterRef | null> {
  const { data, error } = await supabase
    .from('children')
    .select('character_ref')
    .eq('id', childId)
    .single();

  if (error) {
    throw error;
  }
  return (data?.character_ref as CharacterRef | null) ?? null;
}

/**
 * A viewable URL for a locked sheet. Separate from the preview the lock returns,
 * because that one expires — this is how the picker shows a sheet locked days
 * ago. The bucket is private; RLS lets a parent sign only their own child's
 * current reference.
 */
export async function signCharacterRef(
  imagePath: string,
  expiresInSeconds = 60 * 60,
): Promise<string | null> {
  const [bucket, ...rest] = imagePath.split('/');
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(rest.join('/'), expiresInSeconds);

  if (error) {
    return null;
  }
  return data?.signedUrl ?? null;
}
