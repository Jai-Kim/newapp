# ADR-0005 — The app is called Dodam (도담)

Status: accepted · Date: 2026-10-06 · Decider: Jai

## Context

"Storyloom" was a working name. A similar AI-built product (Onceling) exists, and the first user is Boa, a Korean-American child whose family reads Korean first. The name needed to work in both languages.

## Decision

Display name **Dodam** in English and **도담** in Korean. 도담 comes from 도담도담: a child growing steadily and well, which is the product's promise in one word.

- Only the display name changed (`EXPO_PUBLIC_NAME`). Package ids (`com.storyloom`, `com.storyloom.preview`) and the `storyloom` URL scheme stay, because a package id change is a new app to the stores and the scheme change would break deep links.
- 도담 ends in a consonant, so every Korean particle already attached to the old name (은, 의, 을, 과, 이라는) stays grammatical.
- Play lists each language separately: Korean listing name 도담, English listing name Dodam.
- Boa is the hero, not the brand.

## Launch gotchas (open)

- Check Play Store and domain availability for "Dodam" before the production listing. "Dodam" is a common Korean word and name; expect existing apps.
- Changing the package id later is not possible after first publish; decide before creating the Play app if the `com.storyloom` id is acceptable.

## Consequences

Docs and UI copy use Dodam; legacy identifiers remain until a deliberate, separate decision.
