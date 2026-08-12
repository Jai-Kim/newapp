// Storyloom — generate-chapter Edge Function (skeleton)
//
// This is the heart of the moat: retrieve -> generate -> persist. Memory lives
// in Postgres (the Story Bible), NOT in the model's context window. Claude Code
// should flesh out the TODOs in Spike B and prove chapter 2 continues chapter 1
// using only DB-retrieved canon.
//
// Deploy: supabase functions deploy generate-chapter

import { createClient } from "jsr:@supabase/supabase-js@2";

interface GenerateRequest {
  child_id: string;
  lesson: string;      // the value/situation the parent chose for tonight
  situation?: string;  // optional free-text context ("first swim lesson tomorrow")
}

Deno.serve(async (req: Request) => {
  try {
    const { child_id, lesson, situation } = (await req.json()) as GenerateRequest;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. RETRIEVE canon from the Story Bible ---------------------------------
    // Most recent chapter summaries, all OPEN threads, known characters/world.
    const [{ data: recentChapters }, { data: openThreads }, { data: characters }] =
      await Promise.all([
        supabase.from("chapters").select("number,title,summary")
          .eq("child_id", child_id).order("number", { ascending: false }).limit(5),
        supabase.from("threads").select("id,summary,opened_chapter")
          .eq("child_id", child_id).eq("status", "open"),
        supabase.from("characters").select("name,role,traits").eq("child_id", child_id),
      ]);
    // TODO(Spike B+): also pull top-k semantically related past chapters via
    // pgvector using an embedding of `lesson` + `situation`.

    const nextNumber = (recentChapters?.[0]?.number ?? 0) + 1;

    // 2. GENERATE chapter + strict JSON delta --------------------------------
    // Build the prompt from docs/prompts/story-generation.md, injecting the
    // retrieved canon so the model can honor continuity.
    // TODO: call Anthropic API (ANTHROPIC_API_KEY). Expect a response of shape
    //   { chapter_text, title, summary, delta } where delta follows the schema
    //   in docs/prompts/story-generation.md. Validate before persisting.
    const generated = await generateChapter({
      childId: child_id, lesson, situation, nextNumber,
      canon: { recentChapters, openThreads, characters },
    });

    // 3. SAFETY pass ---------------------------------------------------------
    // TODO: content filter + flag for parent preview before the child view.

    // 4. PERSIST canon delta + chapter --------------------------------------
    // TODO: within a transaction/RPC: insert chapter (+ embedding), apply delta
    //   (upsert characters/world, open/resolve threads), log lesson_taught.

    // 5. ILLUSTRATE (async is fine) -----------------------------------------
    // TODO: for each scene, call the image model with locked character refs.

    return Response.json({ ok: true, number: nextNumber, chapter: generated });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
});

// Placeholder — implement against the Anthropic API + the prompt contract.
async function generateChapter(_args: unknown): Promise<unknown> {
  throw new Error("generateChapter not implemented — wire up in Spike B");
}
