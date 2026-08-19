// Storyloom — the storyteller core: retrieve -> generate -> safety -> persist.
//
// Extracted from the generate-chapter HTTP handler because the SAME work now
// has two callers with different authorization stories (issue #9):
//
//   generate-chapter   a parent asking for a chapter right now, holding a JWT
//   the queue worker   a background task with no user session at all, running
//                      off a job row that was authorized when it was created
//
// So nothing in this file knows about requests, headers or users. It takes a
// service-role client and a child id, and the caller is responsible for having
// established that the child is theirs.
//
// Memory lives in Postgres (the Story Bible), NOT in a context window. Every
// run starts cold and rebuilds "the story so far" from the database alone —
// which is exactly what Spike B proves.

import Anthropic from "npm:@anthropic-ai/sdk@0.70.0";
import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";

import { reviewChapter, type SafetyVerdict } from "./safety.ts";

export interface ChapterPage {
  page: number;
  en: string;
  ko: string;
  scene: string;
  wardrobe: string;
  /** True on ~4 pages: the emotional beats that carry a full illustration. */
  illustrated: boolean;
}

export interface ChapterDelta {
  new_characters: { name: string; role: string; traits: string }[];
  new_world: { name: string; type: string; description: string }[];
  threads_opened: { summary: string }[];
  threads_resolved: { id: string; how: string }[];
}

export interface GeneratedChapter {
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

Both language versions of a page must land the same EMOTIONAL BEAT as well as
the same events — if the child is frustrated in English, she is frustrated in
Korean; if she is delighted, curious, or brave, she is that in both. Express that
beat in whatever phrasing is most natural to each language; never translate the
phrasing. The feeling is the lesson, so the two versions must not teach a
different one.

The story must (a) gently land tonight's lesson without lecturing, (b) honor
continuity — reuse existing characters and advance or resolve relevant open
threads, and (c) be soothing bedtime content, never frightening or unsafe.

For each page also give the illustrator a \`scene\` description and a \`wardrobe\`
note. Wardrobe is separate from the character's locked identity (face, hair,
glasses, skin) — identity never changes, but clothing (pyjamas, swimsuit,
raincoat) can and should change to fit the scene.

Mark EXACTLY 4 pages with \`illustrated: true\` and the rest false. Those four are
the emotional beats — the moments a reader would most want to see: where the
feeling turns, where something is discovered, where the comfort lands. Page 1
should almost always be one of them, because it is the picture a parent sees in
the library. Do not simply pick every other page; choose by what the story does.
Every page still gets a \`scene\` description, because an unillustrated page may
be illustrated later.

Return ONLY a JSON object matching the required schema. No prose outside it.`;

/** The canon assembled from the DB — the ONLY story memory the model receives. */
export interface Canon {
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

export async function retrieveCanon(
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
export function canonToPrompt(canon: Canon, lesson: string, situation?: string): string {
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
        required: ["page", "en", "ko", "scene", "wardrobe", "illustrated"],
        properties: {
          page: { type: "integer" },
          en: { type: "string" },
          ko: { type: "string" },
          scene: { type: "string" },
          wardrobe: { type: "string" },
          illustrated: {
            type: "boolean",
            description: "True on exactly 4 pages — the emotional beats",
          },
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

export async function writeChapter(canonBlock: string): Promise<{
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
export async function persist(
  supabase: SupabaseClient,
  childId: string,
  number: number,
  lesson: string,
  situation: string | undefined,
  chapter: GeneratedChapter,
  safety: SafetyVerdict,
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
      safety,
      // A blocked chapter is never offered for approval; everything else waits
      // for a parent. Nothing is ever written straight to child-readable.
      review_status: safety.verdict === "blocked" ? "rejected" : "pending",
    })
    .select("id")
    .single();

  if (chapterErr || !inserted) {
    throw new Error(`insert chapter failed: ${chapterErr?.message}`);
  }

  // A blocked chapter must not pollute the Story Bible — otherwise its
  // characters and threads become canon that future chapters build on.
  if (safety.verdict === "blocked") {
    return inserted.id;
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

/** The whole nightly job in one call: retrieve, write, review, persist. */
export async function generateChapterFor(
  supabase: SupabaseClient,
  childId: string,
  lesson: string,
  situation?: string,
): Promise<{
  chapter_id: string;
  number: number;
  chapter: GeneratedChapter;
  safety: SafetyVerdict;
  latency_ms: number;
  usage: unknown;
  canon: Canon;
  canon_prompt: string;
}> {
  // 1. RETRIEVE — the model's entire memory of the story, from Postgres.
  const canon = await retrieveCanon(supabase, childId);
  const canonBlock = canonToPrompt(canon, lesson, situation);

  // 2. GENERATE — bilingual, page-aligned, plus the Story Bible delta.
  const { chapter, usage, latency_ms } = await writeChapter(canonBlock);

  // 3. SAFETY — an independent reviewer reads both languages before anything
  //    reaches a parent. The storyteller is the wrong judge of its own output,
  //    so this is a separate call, not self-assessment.
  const safety = await reviewChapter(
    Deno.env.get("ANTHROPIC_API_KEY")!,
    canon.child.age_band,
    chapter.title_en,
    chapter.pages,
  );

  // 4. PERSIST — chapter + delta. A blocked chapter is stored for audit but
  //    contributes nothing to canon.
  const chapter_id = await persist(
    supabase, childId, canon.next_number, lesson, situation, chapter, safety,
  );

  return {
    chapter_id,
    number: canon.next_number,
    chapter,
    safety,
    latency_ms,
    usage,
    canon,
    canon_prompt: canonBlock,
  };
}
