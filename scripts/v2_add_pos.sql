-- Step 1: Add part_of_speech to variants and backfill from entries.
-- This gives every variant the entry-level POS as a starting point.
-- Run v2_detect_pos.py after this to auto-correct mismatches.

ALTER TABLE variants ADD COLUMN IF NOT EXISTS part_of_speech TEXT;

UPDATE variants v
SET part_of_speech = e.part_of_speech
FROM entries e
WHERE v.entry_id = e.id
  AND v.part_of_speech IS NULL;

-- Step 2: Add part_of_speech to syriac_words.
-- Leave NULL for now; run v2_propagate_pos.sql after v2_detect_pos.py completes.

ALTER TABLE syriac_words ADD COLUMN IF NOT EXISTS part_of_speech TEXT;
