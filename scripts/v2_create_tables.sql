-- v2 schema: atomic Syriac word tables
-- Run this in the Supabase SQL Editor before running v2_migrate.py

-- One row per unique Syriac word
CREATE TABLE IF NOT EXISTS syriac_words (
    id            BIGSERIAL PRIMARY KEY,
    word          TEXT NOT NULL,           -- full token, e.g. "ܡܲܫܠܸܡ، ܡܲܫܠܘܼܡܹܐ"
    word_normalized TEXT NOT NULL,         -- diacritics stripped, used for dedup
    arabic        TEXT,                    -- Arabic translation (first occurrence only; fill rest manually)
    farsi         TEXT,                    -- Farsi translation (same approach)
    pronunciation TEXT,                    -- future: text-based pronunciation
    audio_url     TEXT,                    -- future: AI-generated or recorded audio
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_syriac_words_normalized
    ON syriac_words(word_normalized);

CREATE INDEX IF NOT EXISTS idx_syriac_words_word
    ON syriac_words USING gin(word gin_trgm_ops);

-- Junction: links English entries to Syriac words
CREATE TABLE IF NOT EXISTS entry_words (
    id               BIGSERIAL PRIMARY KEY,
    entry_id         BIGINT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    syriac_word_id   BIGINT NOT NULL REFERENCES syriac_words(id) ON DELETE CASCADE,
    source_variant_id BIGINT REFERENCES variants(id) ON DELETE SET NULL,
    meaning_group_id INTEGER,              -- groups synonymous words within one entry
    sort_order       INTEGER NOT NULL DEFAULT 0,  -- preserves original order
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entry_words_entry_id
    ON entry_words(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_words_syriac_word_id
    ON entry_words(syriac_word_id);
CREATE INDEX IF NOT EXISTS idx_entry_words_meaning_group
    ON entry_words(entry_id, meaning_group_id);
