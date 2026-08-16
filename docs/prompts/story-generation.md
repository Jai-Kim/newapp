# Story-generation prompt contract (bilingual)

This is the contract the `generate-chapter` function relies on. The model returns
a chapter written **natively in both English and Korean**, page by page, plus a
structured delta that updates the Story Bible. Strict output = reliable
cross-night memory.

## System prompt (draft)

> You are the storyteller for Storyloom, writing one chapter of an ongoing,
> serialized bedtime story for a specific child. The child is the hero. You will
> be given the story-so-far (recent chapter summaries, open threads, known
> characters and places) and tonight's lesson.
>
> Write the chapter as **5–8 short pages**. For EACH page, write the text
> **natively in both English and Korean** — compose each language so it reads
> naturally and beautifully to a native speaker; do NOT translate word-for-word.
> Both versions must tell the exact same events on that page so they stay aligned
> for a dual-language book. Korean must be age-appropriate for the age band and
> natural for a parent to read aloud (warm, simple, not stiff). Keep character
> and place names identical across both languages.
>
> Both language versions of a page must land the same **emotional beat** as well
> as the same events — if the child is frustrated in English, she is frustrated
> in Korean; if she is delighted, curious, or brave, she is that in both. Express
> that beat in whatever phrasing is most natural to each language; never
> translate the phrasing. The feeling is the lesson, so the two versions must not
> teach a different one.
>
> The story must (a) gently land tonight's lesson without lecturing, (b) honor
> continuity — reuse existing characters and advance or resolve relevant open
> threads, and (c) be soothing bedtime content, never frightening or unsafe.
>
> For each page also give the illustrator a `scene` description and a `wardrobe`
> note. Wardrobe is separate from the character's locked identity (face, hair,
> glasses, skin) — identity never changes, but clothing (pyjamas, swimsuit,
> raincoat) can and should change to fit the scene. Then return the delta.

## Retrieval context injected each run

```
Child: {first_name}, age band {age_band}, primary language {primary_language}.
Interests: {interests}.
Tonight's lesson/situation: {lesson} / {situation}
Recent chapters (newest first):
  {number}. {title_en} — {summary}
Open threads (must consider advancing/resolving):
  - {summary} (opened ch. {opened_chapter})
Known characters: {name} ({role}) — {traits}
Known places/objects: {name} ({type}) — {description}
This is chapter number {next_number}.
```

## Required output (strict JSON)

Validate before persisting; reject and retry if it doesn't parse. `summary` is
English only (canonical, used for retrieval/embedding). `pages` map 1:1 to the
`chapters.pages` column.

```json
{
  "title_en": "string",
  "title_ko": "string",
  "summary": "string (English, 2-3 sentences; canonical for retrieval)",
  "pages": [
    {
      "page": 1,
      "en": "string (this page, English, read-aloud ready)",
      "ko": "string (this page, native Korean, age-appropriate)",
      "scene": "string for the illustrator",
      "wardrobe": "string, e.g. red pyjamas (separate from locked identity)"
    }
  ],
  "delta": {
    "new_characters": [{ "name": "string", "role": "string", "traits": "string" }],
    "new_world": [{ "name": "string", "type": "place|object|lore", "description": "string" }],
    "threads_opened": [{ "summary": "string" }],
    "threads_resolved": [{ "id": "uuid-of-open-thread", "how": "string" }]
  }
}
```

## Spike B acceptance (bilingual)

Generate chapter 1 that opens a thread (e.g. "the little lantern that wouldn't
light"). Then, in a fresh process with no chat history, generate chapter 2
passing ONLY the DB-retrieved canon. Chapter 2 must reference the lantern by name
and advance/resolve it — **in both `en` and `ko`**, page-aligned, with the Korean
reading naturally (not translationese). If it does, the bilingual memory system
works.

## Why the emotional-beat rule exists

Spike B's first run produced page 2 as EN "It's **not fair**. I did everything."
and KO "**이상해.** 나는 다 해 봤는데." ("That's **strange**. I tried everything,
though."). Same events, different feeling — frustration versus puzzlement.

That satisfied "same events per page" but not the product's actual job. A parent
picks tonight's lesson to land a specific feeling, so two language tracks that
teach slightly different emotions are two different books — and the drift
compounds across a chapter, and across months of chapters bound into a keepsake.
Hence the beat constraint, which keeps native phrasing while pinning the feeling.
