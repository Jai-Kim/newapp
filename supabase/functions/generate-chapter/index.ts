// Storyloom — generate-chapter Edge Function
//
// This is the moat: retrieve -> generate -> persist. Memory lives in Postgres
// (the Story Bible), NOT in the model's context window. Every run starts cold
// and rebuilds "the story so far" from the database alone — which is exactly
// what Spike B proves.
//
// Output is bilingual and page-aligned per ADR-0001 and the contract in
// docs/prompts/story-generation.md.
//
// Deploy: supabase functions deploy generate-chapter

import Anthropic from "npm:@anthropic-ai/sdk@0.70.0";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

import { handlePreflight, jsonResponse } from "../_shared/cors.ts";

interface GenerateRequest {
  child_id: string;
  lesson: string; // the value/situation the parent chose for tonight
  situation?: string; // optional free-text context
  /** Return the retrieved canon in the response. Spike B evidence; off by default. */
  debug_canon?: boolean;
}

interface ChapterPage {
  page: number;
  en: string;
  ko: string;
  scene: string;
  wardrobe: string;
}

interface ChapterDelta {
  new_characters: { name: string; role: string; traits: string }[];
  new_world: { name: string; type: string; description: string }[];
  threads_opened: { summary: string }[];
  threads_resolved: { id: string; how: string }[];
}

interface GeneratedChapter {
  title_en: string;
  title_ko: string;
  summary: string;
  pages: ChapterPage[];
  delta: ChapterDelta;
}

const SYSTEM = `You are the storyteller for Storyloom, writing one chapter of an
ongoing, serialized bedtime story for a specific child. The child is the hero.
You will be given the story-so-far (recent chapter summaries, open threads, known
characters and places) and tonight's lesson.

Write the chapter as 5-8 short pages. For EACH page, write the text natively in
both English and Korean — compose each language so it reads naturally and
beautifully to a native speaker; do NOT translate word-for-word. Both versions
must tell the exact same events on that page so they stay aligned for a
dual-language book. Korean must be age-appropriate for the age band and natural
for a parent to read aloud (warm, simple, not stiff). Keep character and place
names identical across both languages.

The story must (a) gently land tonight's lesson without lecturing, (b) honor
continuity — reuse existing characters and advance or resolve relevant open
threads, and (c) be soothing bedtime content, never frightening or unsafe.

For each page also give the illustrator a \`scene\` description and a \`wardrobe\`
note. Wardrobe is separate from the character's locked identity (face, hair,
glasses, skin) — identity never changes, but clothing (pyjamas, swimsuit,
raincoat) can and should change to fit the scene.

Return ONLY a JSON object matching the required schema. No prose outside it.`;

/** The canon assembled from the DB — the ONLY story memory the model receives. */
interface Canon {
  child: {
    first_name: string;
    age_band: string;
    primary_language: string;
    interests: string[] | null;
  };
  recent_chapters: { number: number; title_en: string | null; summary: string }[];
  open_threads: { id: string; summary: string; opened_chapter: number | null }[];
  characters: { name: string; role: string | null; traits: string | null }[];
  world: { name: string; type: string | null; description: string | null }[];
  next_number: number;
}

async function retrieveCanon(
  supabase: SupabaseClient,
  childId: string,
): Promise<Canon> {
  const { data: child, error: childErr } = await supabase
    .from("children")
    .select("first_name,age_band,primary_language,interests")
    .eq("id", childId)
    .single();

  if (childErr || !child) {
    throw new Error(`child ${childId} not found: ${childErr?.message ?? "no row"}`);
  }

  const [{ data: recent }, { data: threads }, { data: characters }, { data: world }] =
    await Promise.all([
      supabase.from("chapters").select("number,title_en,summary")
        .eq("child_id", childId).order("number", { ascending: false }).limit(5),
      supabase.from("threads").select("id,summary,opened_chapter")
        .eq("child_id", childId).eq("status", "open"),
      supabase.from("characters").select("name,role,traits").eq("child_id", childId),
      supabase.from("world").select("name,type,description").eq("child_id", childId),
    ]);

  // TODO(post-spike): also pull top-k semantically related past chapters via
  // pgvector on an embedding of `lesson` + `situation`. Recent-N + open threads
  // is enough to prove the mechanism; k-NN improves recall as history grows.

  return {
    child,
    recent_chapters: recent ?? [],
    open_threads: threads ?? [],
    characters: characters ?? [],
    world: world ?? [],
    next_number: (recent?.[0]?.number ?? 0) + 1,
  };
}

/** Renders canon into the prompt block from docs/prompts/story-generation.md. */
function canonToPrompt(canon: Canon, lesson: string, situation?: string): string {
  const lines = [
    `Child: ${canon.child.first_name}, age band ${canon.child.age_band}, `
    + `primary language ${canon.child.primary_language}.`,
    `Interests: ${(canon.child.interests ?? []).join(", ") || "none recorded"}.`,
    `Tonight's lesson/situation: ${lesson} / ${situation ?? "none given"}`,
  ];

  lines.push(
    canon.recent_chapters.length
      ? "Recent chapters (newest first):\n"
        + canon.recent_chapters
          .map((c) => `  ${c.number}. ${c.title_en ?? "(untitled)"} — ${c.summary}`)
          .join("\n")
      : "Recent chapters: none — this is the very first chapter.",
  );

  lines.push(
    canon.open_threads.length
      ? "Open threads (must consider advancing/resolving; use the id when resolving):\n"
        + canon.open_threads
          .map((t) => `  - [${t.id}] ${t.summary} (opened ch. ${t.opened_chapter ?? "?"})`)
          .join("\n")
      : "Open threads: none.",
  );

  lines.push(
    canon.characters.length
      ? "Known characters:\n"
        + canon.characters.map((c) => `  ${c.name} (${c.role ?? "?"}) — ${c.traits ?? ""}`).join("\n")
      : "Known characters: none yet.",
  );

  lines.push(
    canon.world.length
      ? "Known places/objects:\n"
        + canon.world.map((w) => `  ${w.name} (${w.type ?? "?"}) — ${w.description ?? ""}`).join("\n")
      : "Known places/objects: none yet.",
  );

  lines.push(`This is chapter number ${canon.next_number}.`);
  return lines.join("\n");
}

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title_en", "title_ko", "summary", "pages", "delta"],
  properties: {
    title_en: { type: "string" },
    title_ko: { type: "string" },
    summary: { type: "string", description: "English, 2-3 sentences, canonical for retrieval" },
    pages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["page", "en", "ko", "scene", "wardrobe"],
        properties: {
          page: { type: "integer" },
          en: { type: "string" },
          ko: { type: "string" },
          scene: { type: "string" },
          wardrobe: { type: "string" },
        },
      },
    },
    delta: {
      type: "object",
      additionalProperties: false,
      required: ["new_characters", "new_world", "threads_opened", "threads_resolved"],
      properties: {
        new_characters: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "role", "traits"],
            properties: { name: { type: "string" }, role: { type: "string" }, traits: { type: "string" } },
          },
        },
        new_world: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "type", "description"],
            properties: {
              name: { type: "string" },
              type: { type: "string", enum: ["place", "object", "lore"] },
              description: { type: "string" },
            },
          },
        },
        threads_opened: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["summary"],
            properties: { summary: { type: "string" } },
          },
        },
        threads_resolved: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "how"],
            properties: { id: { type: "string" }, how: { type: "string" } },
          },
        },
      },
    },
  },
} as const;

async function writeChapter(canonBlock: string): Promise<{
  chapter: GeneratedChapter;
  usage: unknown;
  latency_ms: number;
}> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  const anthropic = new Anthropic({ apiKey });
  const started = Date.now();

  // Structured outputs guarantee the shape parses, which is what makes the
  // delta safe to apply to the Story Bible without defensive re-parsing.
  const response = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages: [{ role: "user", content: canonBlock }],
  });

  const latency_ms = Date.now() - started;

  if (response.stop_reason === "refusal") {
    throw new Error("generation was declined by safety classifiers");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("generation hit max_tokens — chapter would be truncated");
  }

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("no text block in response");
  }

  return { chapter: JSON.parse(text.text) as GeneratedChapter, usage: response.usage, latency_ms };
}

/** Applies the delta and writes the chapter. */
async function persist(
  supabase: SupabaseClient,
  childId: string,
  number: number,
  lesson: string,
  situation: string | undefined,
  chapter: GeneratedChapter,
) {
  const { data: inserted, error: chapterErr } = await supabase
    .from("chapters")
    .insert({
      child_id: childId,
      number,
      title_en: chapter.title_en,
      title_ko: chapter.title_ko,
      lesson,
      situation: situation ?? null,
      pages: chapter.pages,
      summary: chapter.summary,
    })
    .select("id")
    .single();

  if (chapterErr || !inserted) {
    throw new Error(`insert chapter failed: ${chapterErr?.message}`);
  }

  const d = chapter.delta;

  if (d.new_characters.length) {
    await supabase.from("characters").insert(
      d.new_characters.map((c) => ({
        child_id: childId, name: c.name, role: c.role, traits: c.traits,
        first_appeared_chapter: number,
      })),
    );
  }
  if (d.new_world.length) {
    await supabase.from("world").insert(
      d.new_world.map((w) => ({
        child_id: childId, name: w.name, type: w.type, description: w.description,
      })),
    );
  }
  if (d.threads_opened.length) {
    await supabase.from("threads").insert(
      d.threads_opened.map((t) => ({
        child_id: childId, summary: t.summary, status: "open", opened_chapter: number,
      })),
    );
  }
  for (const t of d.threads_resolved) {
    // Scoped to child_id as well as id: the id comes from model output, and a
    // resolve must never be able to touch another family's thread.
    await supabase.from("threads")
      .update({ status: "resolved", resolved_chapter: number })
      .eq("id", t.id).eq("child_id", childId);
  }

  await supabase.from("lessons_taught").insert({
    child_id: childId, lesson, chapter_id: inserted.id,
  });

  return inserted.id;
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) {
    return preflight;
  }

  try {
    const { child_id, lesson, situation, debug_canon } =
      (await req.json()) as GenerateRequest;

    if (!child_id || !lesson) {
      return jsonResponse({ ok: false, error: "child_id and lesson are required" }, { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. RETRIEVE — the model's entire memory of the story, from Postgres.
    const canon = await retrieveCanon(supabase, child_id);
    const canonBlock = canonToPrompt(canon, lesson, situation);

    // 2. GENERATE — bilingual, page-aligned, plus the Story Bible delta.
    const { chapter, usage, latency_ms } = await writeChapter(canonBlock);

    // 3. SAFETY — TODO(Spike D): content filter + parent-preview gate before
    //    anything reaches the child-facing view.

    // 4. PERSIST — chapter + delta.
    const chapterId = await persist(
      supabase, child_id, canon.next_number, lesson, situation, chapter,
    );

    // 5. ILLUSTRATE — TODO: per page, call the image model with the locked
    //    identity reference + that page's `scene` and `wardrobe`.

    return jsonResponse({
      ok: true,
      chapter_id: chapterId,
      number: canon.next_number,
      chapter,
      latency_ms,
      usage,
      ...(debug_canon ? { retrieved_canon: canon, canon_prompt: canonBlock } : {}),
    });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
