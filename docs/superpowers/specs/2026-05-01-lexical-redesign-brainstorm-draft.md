# Lexical Database Redesign — Brainstorm in Progress

> **Status: PAUSED — user needs to choose an approach before continuing**

## Problem Statement

The current database stores Syriac/Arabic translations as semicolon-separated strings
in a single field (e.g. `"ܠܦܘܼܬ؛ ܒܦܸܚܡܵܐ ܕ...(ܦܚܡ)؛ ܐܲܝܟ݂"`). This is not
atomic — a dictionary should have one word per row so each Syriac word can be
searched, linked, and managed independently.

## Decisions Made So Far

- **One row per Syriac word** — each variant row stores exactly one Syriac word
  paired with one Arabic/Farsi word.
- **Arabic handling on split** — the first split row for each entry gets the full
  original Arabic string as a reference; remaining rows start null and are filled
  in manually over time.
- **Parallel experiment first** — new schema lives alongside the current database
  (same Supabase project, new schema). When complete it can replace the current one.
- **Meaning grouping column** — variants table needs a column to group synonymous
  Syriac words that carry the same meaning (e.g. ܫܒܩ and ܬܪܟ both meaning "abandon").
- **Syriac words as independent entities** — a Syriac word stored once can link to
  multiple English entries.

## Three Proposed Approaches

### Approach 1 — Extended variants (minimal change)
Keep `entries` + `variants`, make variants atomic, add `meaning_id` FK grouping
synonyms. Simple to build. Downside: ܫܒܩ under "abandon" and ܫܒܩ under "leave"
are separate rows with no connection.

### Approach 2 — Meaning-centred schema (linguistically correct)
Central `meanings` table. English, Syriac, Arabic, Farsi all link to meanings.
Most powerful for cross-language lookup. Most complex migration and biggest
frontend change.

### Approach 3 — Syriac word table with meaning links (recommended)
Three tables: `entries` (English, unchanged) + `syriac_words` (one row per
unique Syriac word, with Arabic/Farsi) + junction table `entry_words` (links
entries to Syriac words, carries `meaning_group_id`). ܫܒܩ exists once and connects
to as many English entries as needed. Balanced between correctness and buildability.

## Next Step

**User needs to choose one of the three approaches above.**
Then continue brainstorming → design sections → write full spec → implementation plan.
