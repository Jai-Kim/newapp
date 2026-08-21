// Shared CORS handling for Storyloom Edge Functions.
//
// Expo Router runs the app on web as well as native, so browser callers hit
// these functions cross-origin and send a preflight first. Without an OPTIONS
// handler and Access-Control-* headers the browser blocks the call before it
// ever reaches the function — native clients are unaffected, which is why this
// only ever shows up on web.
//
// Folders prefixed with `_` are bundled as shared code rather than deployed as
// their own function.

export const corsHeaders = {
  // `*` is safe here only because every function still requires a valid JWT in
  // the Authorization header — CORS is not the access control. Narrow this to
  // your real origins if you ever add cookie/credentialed auth, since
  // Allow-Credentials cannot be combined with `*`.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
} as const;

/**
 * Answers a CORS preflight. Returns null when the request isn't one, so callers
 * can do: `const pre = handlePreflight(req); if (pre) return pre;`
 */
export function handlePreflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') {
    return null;
  }
  // 204 + no body is the correct preflight response.
  return new Response(null, { status: 204, headers: corsHeaders });
}

/** Response.json() with the CORS headers merged in. */
export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return Response.json(body, {
    ...init,
    headers: { ...corsHeaders, ...(init.headers ?? {}) },
  });
}
