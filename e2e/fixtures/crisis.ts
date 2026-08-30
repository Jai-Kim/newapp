/**
 * Fixture phrasing for e2e/crisis-input.spec.ts and the crisis check in
 * e2e/support/stubs.ts's stubEnqueue.
 *
 * The real screener (supabase/functions/_shared/crisis.ts) is a model call
 * this harness cannot make — no network access, no API key. The stub instead
 * recognises these two fixed phrases by exact substring, which is enough to
 * exercise the client -> server -> UI plumbing this spec cares about: does a
 * blocked request skip the job, skip the quota, and show the right notice?
 * Whether the *real* model correctly classifies a given piece of Korean or
 * English text is a different question, covered instead by the simulated
 * verdicts in supabase/functions/_shared/crisis-response.test.ts.
 */

/** Self-harm ideation, in Korean, phrased the way a tired parent might type it. */
export const CRISIS_FIXTURE_SITUATION = '요즘 저 자신을 해치고 싶다는 생각이 자꾸 들어요';

/** Ordinary, sad, and exactly what the app is for — must still generate. */
export const NEAR_MISS_FIXTURE_SITUATION = '내일 병원에 가서 예방접종을 맞아요';
