-- Propagate corrected part_of_speech from variants into syriac_words.
-- Run this AFTER v2_add_pos.sql and v2_detect_pos.py have both completed.
--
-- Strategy: each syriac_words row traces back to its source variant via
-- entry_words.source_variant_id. Use the most common POS among all linked
-- variants for that word. When there is a tie or only one value, it resolves
-- cleanly. Words with genuinely conflicting POS across entries stay NULL and
-- must be reviewed manually.

UPDATE syriac_words sw
SET part_of_speech = (
    SELECT v.part_of_speech
    FROM entry_words ew
    JOIN variants v ON ew.source_variant_id = v.id
    WHERE ew.syriac_word_id = sw.id
      AND v.part_of_speech IS NOT NULL
    GROUP BY v.part_of_speech
    ORDER BY count(*) DESC
    LIMIT 1
)
WHERE sw.part_of_speech IS NULL
  AND EXISTS (
    SELECT 1
    FROM entry_words ew
    JOIN variants v ON ew.source_variant_id = v.id
    WHERE ew.syriac_word_id = sw.id
      AND v.part_of_speech IS NOT NULL
  );

-- After running, check how many syriac_words still have no POS:
-- SELECT count(*) FROM syriac_words WHERE part_of_speech IS NULL;
--
-- Check words with conflicting POS across variants (review candidates):
-- SELECT sw.id, sw.word, array_agg(DISTINCT v.part_of_speech) AS pos_values
-- FROM syriac_words sw
-- JOIN entry_words ew ON ew.syriac_word_id = sw.id
-- JOIN variants v ON ew.source_variant_id = v.id
-- WHERE v.part_of_speech IS NOT NULL
-- GROUP BY sw.id, sw.word
-- HAVING count(DISTINCT v.part_of_speech) > 1
-- ORDER BY sw.word;
