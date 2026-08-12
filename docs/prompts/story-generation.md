# Story-generation prompt contract

This is the contract the `generate-chapter` function relies on. The model must
return a chapter AND a structured delta that updates the Story Bible. Keeping the
delta strict is what makes cross-night memory reliable.

## System prompt (draft)

> You are the storyteller for Storyloom, writing one chapter of an ongoing,
> serialized bedtime story for a specific child. The child is the hero. You will
> be given the story-so-far (recent chapter summaries, open threads, known
> characters and places) and tonight's lesson. Write a warm, age-appropriate
> chapter (reading level for the given age band) that (a) gently lands tonight's
> lesson without lecturing, (b) honors continuity — reuse existing characters and
> advance or resolve relevant open threads, and (c) is designed to be read aloud
> by a parent. Length: ~350–600 words for ages 3–6. Never introduce frightening
> or unsafe content. Then return a structured delta describing what changed in
> the story world.

## Retrieval context injected each run

```
Child: {first_name}, age band {age_band}. Interests: {interests}.
Tonight's lesson/situation: {lesson} / {situation}
Recent chapters (newest first):
  {number}. {title} — {summary}
Open threads (must consider advancing/resolving):
  - {summary} (opened ch. {opened_chapter})
Known characters: {name} ({role}) — {traits}
Known places/objects: {name} ({type}) — {description}
This is chapter number {next_number}.
```

## Required output (strict JSON)

The model returns exactly this shape (chapter text + delta). Validate before
persisting; reject and retry if it doesn't parse.

```json
{
  "title": "string",
  "chapter_text": "string (the full chapter, read-aloud ready)",
  "summary": "string (2-3 sentences; used for future retrieval)",
  "delta": {
    "new_characters": [{ "name": "string", "role": "string", "traits": "string" }],
    "new_world": [{ "name": "string", "type": "place|object|lore", "description": "string" }],
    "threads_opened": [{ "summary": "string" }],
    "threads_resolved": [{ "id": "uuid-of-open-thread", "how": "string" }],
    "scenes": [{ "page": 1, "description": "string for the illustrator" }]
  }
}
```

## Spike B acceptance

Generate chapter 1 that opens a thread (e.g. "the little lantern that wouldn't
light"). Then, in a fresh process with no chat history, generate chapter 2
passing ONLY the DB-retrieved canon. Chapter 2 must reference the lantern by
name and advance/resolve it. If it does, the memory system works.
