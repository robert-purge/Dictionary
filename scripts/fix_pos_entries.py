"""
Fix broken POS abbreviation entries in Supabase.

When the parser encountered a line like:
    pair   vt. [Syriac]
           vi. [Syriac]   <-- 'vi.' on its own line got parsed as a new entry

...it created a standalone entry with english='vi.' (or 'vt.', 'adj.', 'n.')
instead of adding a second variant to the real word.

This script:
  1. Loads all Supabase entries in insertion order (matches dictionary.json order).
  2. For each broken index, verifies the entry looks right.
  3. Moves all variants from the broken entry to the correct parent entry.
  4. Deletes the now-empty broken entry.

Usage:
    python scripts/fix_pos_entries.py           # live run
    python scripts/fix_pos_entries.py --dry-run # preview only, no changes
"""
import json, os, sys
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

DRY_RUN = '--dry-run' in sys.argv

# JSON indices (0-based) of the broken POS entries, in document order.
# Each entry at index i should belong to the entry at index i-1.
BROKEN_INDICES = [
    6582, 6615, 7213,                                           # adj.
    7226, 7376, 7414, 7416, 7447, 7486, 7633,                  # vi.
    7826, 7832, 7835, 7880, 7945,                              # vi.
    7947,                                                       # n.
    7958, 8053, 8201, 8266, 8349, 8403, 8447, 8580, 8646, 8649, # vi.
    8887, 8890, 8921, 8983, 9011, 9154, 9231, 9254, 9271, 9342, 9434, # vi.
    9505,                                                       # adj. (see Sabaean)
    9799, 9857, 9901,                                           # vi.
    9917,                                                       # adj.
    10185, 10223, 10228, 10304, 10376, 10398, 10423, 10439, 10613, # vi.
    10921, 11002,                                               # vi.
    11062,                                                      # vt.
    11199,                                                      # vi.
    11335,                                                      # vt.
    11523,                                                      # adj.
    12036, 12057, 12344,                                        # vi.
    12730,                                                      # vi.
    12964, 12980,                                               # vi.
    13061,                                                      # vi.
    13208,                                                      # adj. (see whatever)
    13272, 13273,                                               # vt. then n. (chain after whizz)
    13282,                                                      # vi.
    13632,                                                      # vi.
]

POS_ABBREVS = {'vi.', 'vt.', 'adj.', 'n.', 'vi', 'vt', 'adj', 'n'}


def fetch_all_entries(client):
    """Fetch all entries ordered by id (matches JSON insertion order)."""
    rows = []
    page_size = 1000
    offset = 0
    while True:
        result = (
            client.table('entries')
            .select('id, english')
            .order('id')
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size
    return rows


def main():
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    print('Fetching all entries from Supabase...')
    db_entries = fetch_all_entries(client)
    print(f'  Found {len(db_entries)} entries in database.')

    if len(db_entries) == 0:
        print('ERROR: No entries found. Check SUPABASE_URL and SUPABASE_KEY.')
        sys.exit(1)

    # Load JSON to verify we're looking at the right entries
    json_path = 'data/dictionary.json'
    with open(json_path, encoding='utf-8') as f:
        json_entries = json.load(f)

    print(f'  Found {len(json_entries)} entries in dictionary.json.')

    if len(db_entries) != len(json_entries):
        print(f'WARNING: DB has {len(db_entries)} entries but JSON has {len(json_entries)}.')
        print('         The index mapping may be off. Proceeding with verification...')

    fixes = []    # list of (broken_id, correct_id, broken_english, correct_english)
    skipped = []

    for idx in BROKEN_INDICES:
        if idx >= len(db_entries):
            skipped.append((idx, f'index out of range (db has {len(db_entries)} entries)'))
            continue

        db_broken  = db_entries[idx]
        db_correct = db_entries[idx - 1]

        broken_eng  = db_broken['english']
        correct_eng = db_correct['english']

        # Verify this looks like a POS abbreviation entry
        if broken_eng.rstrip('.') not in {'vi', 'vt', 'adj', 'n', 'adv', 'prep'}:
            skipped.append((idx, f"'{broken_eng}' doesn't look like a POS abbreviation — skipping"))
            continue

        # Cross-check with JSON if sizes match
        if len(db_entries) == len(json_entries):
            json_broken  = json_entries[idx]['english']
            json_correct = json_entries[idx - 1]['english']
            if broken_eng != json_broken or correct_eng != json_correct:
                skipped.append((
                    idx,
                    f"DB mismatch: DB=({correct_eng!r}, {broken_eng!r}) "
                    f"JSON=({json_correct!r}, {json_broken!r})"
                ))
                continue

        fixes.append((db_broken['id'], db_correct['id'], broken_eng, correct_eng))

    print(f'\nFound {len(fixes)} entries to fix, {len(skipped)} skipped.')

    if skipped:
        print('\nSkipped:')
        for idx, reason in skipped:
            print(f'  [{idx}] {reason}')

    if not fixes:
        print('Nothing to do.')
        return

    print(f'\n{"[DRY RUN] " if DRY_RUN else ""}Fixes to apply:')
    for broken_id, correct_id, broken_eng, correct_eng in fixes:
        print(f"  Move variants from '{broken_eng}' (id={broken_id}) → '{correct_eng}' (id={correct_id})")

    if DRY_RUN:
        print('\nDry run complete. No changes made. Run without --dry-run to apply.')
        return

    print(f'\nApplying {len(fixes)} fixes...')

    moved = 0
    deleted = 0
    errors = []

    for broken_id, correct_id, broken_eng, correct_eng in fixes:
        try:
            # Move all variants to the correct parent entry
            client.table('variants') \
                .update({'entry_id': correct_id}) \
                .eq('entry_id', broken_id) \
                .execute()

            # Delete the now-empty broken entry
            client.table('entries') \
                .delete() \
                .eq('id', broken_id) \
                .execute()

            moved += 1
            deleted += 1
        except Exception as e:
            errors.append((broken_id, correct_id, broken_eng, correct_eng, str(e)))

    print(f'\nDone.')
    print(f'  Variants reassigned for {moved} entries.')
    print(f'  Broken entries deleted: {deleted}.')

    if errors:
        print(f'\nErrors ({len(errors)}):')
        for broken_id, correct_id, broken_eng, correct_eng, err in errors:
            print(f"  '{broken_eng}' (id={broken_id}) → '{correct_eng}' (id={correct_id}): {err}")


if __name__ == '__main__':
    main()
