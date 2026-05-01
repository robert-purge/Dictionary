"""
Fix 'garbled-pos' entries: entries where non-ASCII text (Syriac/Arabic)
or an overly long string bled into the part_of_speech field during parsing.

This script:
  1. Finds entries whose variants all have empty Assyrian AND Arabic.
  2. Keeps only those where part_of_speech contains non-ASCII or is >31 chars.
  3. Prints them so you can decide what the correct POS is.
  4. Clears (sets to NULL) the garbled part_of_speech field so the entry
     shows up cleanly in the dictionary while awaiting manual translation.

Usage:
    python scripts/fix_garbled_pos.py           # live run (clears garbled POS)
    python scripts/fix_garbled_pos.py --dry-run # preview only, no changes
"""
import os, re, sys
sys.stdout.reconfigure(encoding='utf-8')
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

DRY_RUN = '--dry-run' in sys.argv

VALID_POS = {
    'n', 'n.', 'adj', 'adj.', 'vt', 'vt.', 'vi', 'vi.',
    'adv', 'adv.', 'prep', 'prep.', 'interj', 'interj.',
}


def is_garbled(pos: str) -> bool:
    if re.search(r'[^\x00-\x7F]', pos):
        return True
    if len(pos) > 31:
        return True
    return False


def main():
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Fetch all entries in pages
    print("Fetching all entries...")
    all_entries, page, page_size = [], 0, 1000
    while True:
        result = (
            client.table('entries')
            .select('id, english, part_of_speech')
            .range(page * page_size, (page + 1) * page_size - 1)
            .execute()
        )
        all_entries.extend(result.data)
        if len(result.data) < page_size:
            break
        page += 1

    print(f"  Loaded {len(all_entries)} entries.")

    # Fetch all variants that are empty (assy AND arabic)
    print("Fetching empty variants...")
    all_variants, page = [], 0
    while True:
        result = (
            client.table('variants')
            .select('id, entry_id, assyrian, arabic')
            .range(page * page_size, (page + 1) * page_size - 1)
            .execute()
        )
        all_variants.extend(result.data)
        if len(result.data) < page_size:
            break
        page += 1

    # Group variants by entry_id
    from collections import defaultdict
    variants_by_entry: dict[int, list] = defaultdict(list)
    for v in all_variants:
        variants_by_entry[v['entry_id']].append(v)

    # Find entries whose all variants are empty
    empty_entry_ids = set()
    for eid, vs in variants_by_entry.items():
        if all(
            not (v.get('assyrian') or '').strip()
            and not (v.get('arabic')   or '').strip()
            for v in vs
        ):
            empty_entry_ids.add(eid)

    # Filter to garbled-POS entries
    entries_map = {e['id']: e for e in all_entries}
    garbled = []
    for eid in empty_entry_ids:
        entry = entries_map.get(eid)
        if not entry:
            continue
        pos = (entry.get('part_of_speech') or '').strip()
        if not pos:
            continue
        # Skip valid POS
        if pos.lower() in VALID_POS:
            continue
        # Skip 'see' headwords (handled by fix_swapped_entries.py)
        if entry['english'].strip().lower() == 'see':
            continue
        if is_garbled(pos):
            garbled.append(entry)

    garbled.sort(key=lambda e: e['english'])
    print(f"  Found {len(garbled)} garbled-POS entries.")

    if not garbled:
        print("Nothing to fix.")
        return

    print(f"\n{'[DRY RUN] ' if DRY_RUN else ''}Garbled-POS entries (will clear part_of_speech):")
    print(f"  {'entry_id':>8}  {'english':30}  garbled pos")
    print(f"  {'-'*70}")
    for e in garbled:
        pos = (e.get('part_of_speech') or '').strip()
        pos_disp = (pos[:40] + '…') if len(pos) > 41 else pos
        print(f"  {e['id']:>8}  {e['english']:30}  {pos_disp}")

    if DRY_RUN:
        print('\nDry run complete. No changes made. Run without --dry-run to apply.')
        return

    print(f"\nClearing garbled part_of_speech on {len(garbled)} entries...")

    fixed = 0
    errors = []
    for e in garbled:
        try:
            client.table('entries') \
                .update({'part_of_speech': None}) \
                .eq('id', e['id']) \
                .execute()
            fixed += 1
        except Exception as ex:
            errors.append((e['id'], e['english'], str(ex)))

    print(f"\nDone. Cleared POS on {fixed} entries.")
    if errors:
        print(f"\nErrors ({len(errors)}):")
        for eid, eng, err in errors:
            print(f"  entry_id={eid} '{eng}': {err}")

    print("""
Next step:
  These entries have real English headwords but garbled POS.
  You can find the correct translations in the original .docx
  and update each variant's assyrian/arabic fields manually in Supabase.
""")


if __name__ == "__main__":
    main()
