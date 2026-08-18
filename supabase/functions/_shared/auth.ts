// Storyloom — caller identity and authorization for Edge Functions.
//
// Issue #6: generate-chapter spends real money at a paid provider, and the anon
// key ships in the app bundle, so it is public. CORS does not help — curl
// ignores it. Every function that costs money must therefore prove (a) a real
// signed-in user is calling, and (b) that user is allowed to touch this child.
//
// (b) is the part that is easy to miss. The functions run under the service
// role, which bypasses RLS entirely — so without an explicit ownership check,
// any authenticated user could pass someone else's child_id and read or write
// another family's story.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export class AuthError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Resolves the caller from their JWT. Throws AuthError(401) when absent or
 * invalid — never falls back to anonymous.
 */
export async function requireUser(req: Request): Promise<{ id: string; email?: string }> {
  const header = req.headers.get("Authorization") ?? "";
  const jwt = header.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    throw new AuthError("missing Authorization header", 401);
  }

  // A client bound to the caller's token; getUser validates the signature and
  // expiry server-side rather than trusting anything we decode ourselves.
  const scoped: SupabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );

  const { data, error } = await scoped.auth.getUser();
  if (error || !data.user) {
    // The anon key itself is a valid JWT, so an unauthenticated call lands here
    // rather than at the missing-header check above.
    throw new AuthError("not signed in", 401);
  }
  return { id: data.user.id, email: data.user.email ?? undefined };
}

/**
 * Confirms the child belongs to the caller's family.
 *
 * Uses the service client deliberately: RLS would already hide another family's
 * rows from a scoped client, but these functions need the service role for
 * their real work, so ownership has to be asserted explicitly here.
 */
export async function assertOwnsChild(
  service: SupabaseClient,
  childId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await service
    .from("children")
    .select("id, families!inner(auth_user_id)")
    .eq("id", childId)
    .single();

  if (error || !data) {
    // Deliberately the same message as the ownership failure below: a probing
    // caller should not be able to tell "no such child" from "not yours".
    throw new AuthError("child not found", 404);
  }

  const owner = (data as unknown as { families: { auth_user_id: string | null } })
    .families?.auth_user_id;
  if (owner !== userId) {
    throw new AuthError("child not found", 404);
  }
}

/** Turns an AuthError into its status; anything else is a 500. */
export function statusFor(err: unknown): number {
  return err instanceof AuthError ? err.status : 500;
}
