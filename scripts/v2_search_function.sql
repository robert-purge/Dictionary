-- v2 search RPC — run this in Supabase SQL Editor
-- Returns the same shape as search_dictionary so the frontend needs no type changes.
-- Each variant item is now one atomic Syriac word instead of a semicolon-separated string.

CREATE OR REPLACE FUNCTION search_dictionary_v2(query_text TEXT, lang TEXT)
RETURNS TABLE(
    id            BIGINT,
    english       TEXT,
    part_of_speech TEXT,
    variants      JSONB
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN

    -- ── English search ────────────────────────────────────────────────────────
    IF lang = 'english' THEN
        RETURN QUERY
        SELECT
            e.id,
            e.english,
            e.part_of_speech,
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id',                   sw.id,
                        'number',               sub.sort_order,
                        'assyrian',             sw.word,
                        'assyrian_normalized',  sw.word_normalized,
                        'arabic',               sw.arabic,
                        'farsi',                sw.farsi,
                        'example_arabic',       NULL,
                        'example_assyrian',     NULL
                    ) ORDER BY sub.sort_order
                )
                FROM (
                    SELECT DISTINCT ON (ew.syriac_word_id)
                        ew.syriac_word_id, ew.sort_order
                    FROM entry_words ew
                    WHERE ew.entry_id = e.id
                    ORDER BY ew.syriac_word_id, ew.sort_order
                ) sub
                JOIN syriac_words sw ON sw.id = sub.syriac_word_id
            ) AS variants
        FROM entries e
        WHERE e.english ILIKE '%' || query_text || '%'
           OR e.english % query_text
        ORDER BY similarity(lower(e.english), lower(query_text)) DESC
        LIMIT 20;

    -- ── Syriac search ─────────────────────────────────────────────────────────
    ELSIF lang = 'syriac' THEN
        RETURN QUERY
        SELECT
            e.id,
            e.english,
            e.part_of_speech,
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id',                   sw2.id,
                        'number',               sub.sort_order,
                        'assyrian',             sw2.word,
                        'assyrian_normalized',  sw2.word_normalized,
                        'arabic',               sw2.arabic,
                        'farsi',                sw2.farsi,
                        'example_arabic',       NULL,
                        'example_assyrian',     NULL
                    ) ORDER BY sub.sort_order
                )
                FROM (
                    SELECT DISTINCT ON (ew2.syriac_word_id)
                        ew2.syriac_word_id, ew2.sort_order
                    FROM entry_words ew2
                    WHERE ew2.entry_id = e.id
                    ORDER BY ew2.syriac_word_id, ew2.sort_order
                ) sub
                JOIN syriac_words sw2 ON sw2.id = sub.syriac_word_id
            ) AS variants
        FROM (
            SELECT e2.id, e2.english, e2.part_of_speech,
                   MAX(similarity(sw.word_normalized, query_text)) AS score
            FROM syriac_words sw
            JOIN entry_words ew ON ew.syriac_word_id = sw.id
            JOIN entries e2 ON e2.id = ew.entry_id
            WHERE sw.word_normalized % query_text
            GROUP BY e2.id, e2.english, e2.part_of_speech
            ORDER BY score DESC
            LIMIT 20
        ) e
        ORDER BY (
            SELECT MAX(similarity(sw.word_normalized, query_text))
            FROM syriac_words sw
            JOIN entry_words ew ON ew.syriac_word_id = sw.id
            WHERE ew.entry_id = e.id
        ) DESC;

    -- ── Arabic search ─────────────────────────────────────────────────────────
    ELSIF lang = 'arabic' THEN
        RETURN QUERY
        SELECT
            e.id,
            e.english,
            e.part_of_speech,
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id',                   sw2.id,
                        'number',               sub.sort_order,
                        'assyrian',             sw2.word,
                        'assyrian_normalized',  sw2.word_normalized,
                        'arabic',               sw2.arabic,
                        'farsi',                sw2.farsi,
                        'example_arabic',       NULL,
                        'example_assyrian',     NULL
                    ) ORDER BY sub.sort_order
                )
                FROM (
                    SELECT DISTINCT ON (ew2.syriac_word_id)
                        ew2.syriac_word_id, ew2.sort_order
                    FROM entry_words ew2
                    WHERE ew2.entry_id = e.id
                    ORDER BY ew2.syriac_word_id, ew2.sort_order
                ) sub
                JOIN syriac_words sw2 ON sw2.id = sub.syriac_word_id
            ) AS variants
        FROM (
            SELECT e2.id, e2.english, e2.part_of_speech,
                   MAX(similarity(sw.arabic, query_text)) AS score
            FROM syriac_words sw
            JOIN entry_words ew ON ew.syriac_word_id = sw.id
            JOIN entries e2 ON e2.id = ew.entry_id
            WHERE sw.arabic % query_text
            GROUP BY e2.id, e2.english, e2.part_of_speech
            ORDER BY score DESC
            LIMIT 20
        ) e
        ORDER BY (
            SELECT MAX(similarity(sw.arabic, query_text))
            FROM syriac_words sw
            JOIN entry_words ew ON ew.syriac_word_id = sw.id
            WHERE ew.entry_id = e.id
        ) DESC;

    END IF;
END;
$$;
