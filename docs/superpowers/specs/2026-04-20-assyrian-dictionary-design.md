# Assyrian Dictionary — Design Spec
**Date:** 2026-04-20

---

## Overview

A responsive multilingual dictionary website for the Assyrian language. Users type a word in any supported language and instantly see translations in all others. The primary data source is an existing MS Word document containing English headwords with Assyrian and Arabic translations.

**Languages:** English · Assyrian (Syriac script) · Arabic · Farsi (placeholder, populated via Google Translate)
**Target platform:** Responsive website — works on desktop, mobile, and any device with a browser
**Hosting:** Vercel (free tier)

---

## Architecture

### Components

1. **Next.js app** — React frontend + API routes in one project. Deployed to Vercel.
2. **Supabase (PostgreSQL)** — hosted database, free tier. Stores all dictionary entries. Exposes a search API via Next.js API routes.
3. **Data pipeline (one-time scripts):**
   - Python script: parses the Word document → outputs structured JSON
   - Import script: loads JSON into Supabase
   - Farsi enrichment script: calls Google Translate API to fill `farsi` column (run once after import)

### Data Flow

```
User types → Next.js API route → PostgreSQL (pg_trgm search) → ranked results → rendered in browser
```

Language is auto-detected from the input characters:
- Syriac Unicode (U+0700–U+074F) → search `assyrian` column
- Arabic/Farsi Unicode (U+0600–U+06FF) → search `arabic` and `farsi` columns
- Latin characters → search `english` column

---

## Database Schema

### Table: `entries`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `serial PRIMARY KEY` | Auto-increment ID |
| `english` | `text NOT NULL` | English headword (e.g. "abase") |
| `part_of_speech` | `text` | e.g. "vt.", "n.", "adv." |
| `created_at` | `timestamptz` | Auto-set on insert |

### Table: `variants`

Each entry can have multiple numbered senses (1°, 2°, 3°...).

| Column | Type | Description |
|--------|------|-------------|
| `id` | `serial PRIMARY KEY` | |
| `entry_id` | `int REFERENCES entries(id)` | Parent entry |
| `number` | `int` | Variant number (1, 2, 3...) |
| `assyrian` | `text` | Assyrian (Syriac) translation |
| `arabic` | `text` | Arabic translation |
| `farsi` | `text` | Farsi translation (nullable, filled later) |
| `example_assyrian` | `text` | Example sentence in Assyrian (nullable) |
| `example_arabic` | `text` | Example sentence in Arabic (nullable) |

### Indexes

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_entries_english_trgm ON entries USING gin (english gin_trgm_ops);
CREATE INDEX idx_variants_assyrian_trgm ON variants USING gin (assyrian gin_trgm_ops);
CREATE INDEX idx_variants_arabic_trgm ON variants USING gin (arabic gin_trgm_ops);
CREATE INDEX idx_variants_farsi_trgm ON variants USING gin (farsi gin_trgm_ops);
```

---

## Search

### API Route: `GET /api/search?q=<query>`

1. Detect language from input character range
2. Run trigram similarity query against the appropriate column
3. Return top 20 results ordered by similarity score, each including all variant translations

### Search behavior

- **Prefix match** wins (highest rank) — "ab" matches "abase" immediately
- **Substring match** — "base" also finds "abase"
- **Fuzzy / typo tolerance** — "abaze" still finds "abase" via trigram similarity
- Results are deduplicated and ranked by `similarity()` score

---

## Data Pipeline

### Phase 1 — Word doc → JSON

A Python script (`scripts/parse_word.py`) reads the `.docx` file and outputs `data/dictionary.json`:

```json
[
  {
    "english": "abase",
    "part_of_speech": "vt.",
    "variants": [
      {
        "number": 1,
        "assyrian": "ܝܟܝܕ، ܝܟܡܝܕ",
        "arabic": "يُذل، يحقّر",
        "farsi": null
      }
    ]
  }
]
```

### Phase 2 — JSON → Supabase

A script (`scripts/import_data.py`) reads `dictionary.json` and inserts all rows into the `entries` and `variants` tables.

### Phase 3 — Farsi enrichment (one-time)

A script (`scripts/enrich_farsi.py`) queries all variants where `farsi IS NULL`, sends the English headword to the Google Translate API (EN → FA), and updates the `farsi` column. Runs once; can be re-run to fill gaps.

---

## Frontend

### Layout (Desktop)

- **Navbar:** Logo ("ܐܬܘܪܝܐ Dictionary"), subtitle "Assyrian · English · Arabic · Farsi"
- **Left panel:** Search box + results list (word + part of speech)
- **Right panel:** Selected word detail — headword, all variants with Assyrian / Arabic / Farsi translations

### Layout (Mobile)

- Single column — search bar at top, results list below, tapping a result opens a detail view

### Design

- Background: Assyrian flag (from Wikimedia Commons SVG) at ~10% opacity as a full-page watermark
- Colors: `#003DA5` (blue), `#F7A800` (gold), `#D21034` (red) — from the flag
- Accent bar on result cards: gradient blue → gold → red
- RTL text for Assyrian, Arabic, Farsi; LTR for English
- Syriac font: Estrangelo Edessa or system fallback

### Search UX

- Single search bar — no language selector tabs
- Placeholder text: "Search in English, ܐܬܘܪܝܐ, عربي, or فارسی"
- Language detected silently from input characters
- Results update as the user types (debounced, ~200ms)

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router, latest stable) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL + pg_trgm) |
| Hosting | Vercel |
| Data pipeline | Python 3 (python-docx, supabase-py) |
| Farsi translation | Google Translate API (one-time) |

---

## Out of Scope (v1)

- User accounts, favorites, bookmarking
- Audio pronunciation
- App store distribution
- Admin dashboard for editing entries
- Community contributions / corrections
