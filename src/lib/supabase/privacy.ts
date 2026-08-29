import { supabase } from './client';

/**
 * Records that the signed-in parent's family agreed to a version of the
 * privacy/AI-disclosure notice (issue #12, `docs/privacy/`).
 *
 * Goes through the client, not an Edge Function, same reasoning as
 * `createFamilyAndChild` in `onboarding.ts`: RLS decides ownership, so
 * writing through the caller's own session is what proves the policy works.
 * No user id is passed in — `privacy_consents`'s WITH CHECK derives the
 * owning family from `auth.uid()` itself.
 */
export async function recordPrivacyConsent(
  familyId: string,
  policyVersion: string,
): Promise<void> {
  const { error } = await supabase.from('privacy_consents').insert({
    family_id: familyId,
    policy_version: policyVersion,
  });
  if (error) {
    throw error;
  }
}
