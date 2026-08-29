import type { AgeBand, Child, Language } from './types';

import { supabase } from './client';

/**
 * Account bootstrap: one family, one child.
 *
 * Both inserts go through the *client*, not an Edge Function, deliberately —
 * RLS is what decides ownership, so writing through the caller's own session is
 * the path that proves the policies work. A family row that named someone
 * else's `auth_user_id` would be rejected by the `with check` clause rather
 * than by anything this file does.
 */

export type ChildDraft = {
  first_name: string;
  age_band: AgeBand;
  primary_language: Language;
  interests: string[];
  /**
   * The privacy-notice version the parent explicitly agreed to, and when.
   * Required, not optional: PIPA requires this consent to exist before a
   * child's data is collected, not attached after the fact (issue #12).
   */
  privacy_consent_version: string;
  privacy_consented_at: string;
};

/** The signed-in user's family, or null before onboarding. */
export async function getMyFamily(): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('families')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ?? null;
}

export async function getMyChild(): Promise<Child | null> {
  const { data, error } = await supabase
    .from('children')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return (data as Child) ?? null;
}

/**
 * Creates the family (if absent) and the child. Idempotent on the family so a
 * retry after a failed child insert doesn't strand a second family row.
 */
export async function createFamilyAndChild(draft: ChildDraft): Promise<Child> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    throw new Error('You need to be signed in to set up a child.');
  }

  let family = await getMyFamily();
  if (!family) {
    const { data, error } = await supabase
      .from('families')
      .insert({ auth_user_id: userData.user.id })
      .select('id')
      .single();
    if (error) {
      throw error;
    }
    family = data;
  }

  const { data: child, error: childErr } = await supabase
    .from('children')
    .insert({
      family_id: family.id,
      first_name: draft.first_name.trim(),
      age_band: draft.age_band,
      primary_language: draft.primary_language,
      interests: draft.interests,
      privacy_consent_version: draft.privacy_consent_version,
      privacy_consented_at: draft.privacy_consented_at,
    })
    .select('*')
    .single();

  if (childErr) {
    // The one-child trigger raises a plain exception; surface its hint rather
    // than a raw Postgres error.
    if (childErr.message.includes('one child per family')) {
      throw new Error('This account already has a child set up.');
    }
    throw childErr;
  }
  return child as Child;
}
