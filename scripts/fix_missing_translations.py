"""
Fix missing-translation entries by recovering translations from phantom
'label' entries immediately after them in the database.

In the source .docx many entries look like:
    narcissus  n.
    bot.  ܫܘܿܫܲܢܲܬ ܡܲܠܟܵܐ(ܢ.)  النرجس(نبات)

The parser read the second line as a NEW entry with English headword "bot."
and put the Syriac/Arabic in ITS variant. This script reverses that:
  1. Finds each empty-translation entry in DB order.
  2. Looks at the next DB entry — if its headword is a domain/POS label
     (bot., zoo, med., anat., adj., vi., …) it's a phantom.
  3. Copies the Syriac/Arabic from the phantom's variant(s) into the
     missing entry's variant, then deletes the phantom.

Usage:
    python scripts/fix_missing_translations.py           # live run
    python scripts/fix_missing_translations.py --dry-run # preview, no changes
"""
import json, os, re, sys
sys.stdout.reconfigure(encoding='utf-8')
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

DRY_RUN = '--dry-run' in sys.argv

VALID_POS = {
    'n', 'n.', 'adj', 'adj.', 'vt', 'vt.', 'vi', 'vi.',
    'adv', 'adv.', 'prep', 'prep.', 'interj', 'interj.',
}

# Short domain/POS label prefixes the parser mistook for headwords
LABEL_PREFIXES = {
    'bot', 'zoo', 'med', 'anat', 'ast', 'bib', 'chris', 'gram',
    'lin', 'chu', 'eccl', 'arch', 'mus', 'mil', 'zool', 'pl',
    'new.test', 'adj.chris',
    # POS variants that weren't caught by fix_pos_entries.py
    'adj', 'vi', 'vt', 'adv', 'prep', 'interj', 'n',
}


def is_label(english: str) -> bool:
    """Return True if this headword is a domain/POS label rather than a real word."""
    eng = english.strip().lower()
    # Non-ASCII bled into headword — definitely garbled/phantom
    if re.search(r'[^\x00-\x7F]', eng):
        return True
    # Strip trailing variant number (e.g. "bot. 1" → "bot.")
    base = re.sub(r'\s+\d+\s*$', '', eng).strip()
    # Known prefix (with or without trailing dot)
    prefix = base.rstrip('.').strip()
    if prefix in LABEL_PREFIXES:
        return True
    # Anything with a dot and short enough is likely an abbreviation label
    if '.' in base and len(base) <= 15:
        return True
    return False


def is_missing_translation(entry: dict) -> bool:
    eng = entry.get('english', '').strip().lower()
    pos = (entry.get('part_of_speech') or '').strip().lower()
    if 'see' in pos or eng == 'see':
        return False
    if re.search(r'[^\x00-\x7F]', pos):
        return False
    if pos and pos not in VALID_POS:
        return False
    return True  # caller checks variants separately


def fetch_all_entries(client):
    rows, page_size, offset = [], 1000, 0
    while True:
        result = (
            client.table('entries')
            .select('id, english, part_of_speech')
            .order('id')
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size
    return rows


def fetch_all_variants(client) -> dict:
    """Fetch every variant with pagination. Returns {entry_id: [variants]}."""
    result_map: dict[int, list] = {}
    page_size, page = 1000, 0
    while True:
        rows = (
            client.table('variants')
            .select('id, entry_id, number, assyrian, arabic, farsi, assyrian_normalized')
            .range(page * page_size, (page + 1) * page_size - 1)
            .execute()
            .data
        )
        for v in rows:
            result_map.setdefault(v['entry_id'], []).append(v)
        if len(rows) < page_size:
            break
        page += 1
    return result_map


def normalize_syriac(text: str) -> str:
    return re.sub(r'[ܰ-݊]', '', text)


def main():
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("Fetching all entries from Supabase (ordered by id)…")
    db_entries = fetch_all_entries(client)
    print(f"  Loaded {len(db_entries)} entries.")

    print("Fetching all variants…")
    variants_map = fetch_all_variants(client)
    print(f"  Loaded variants for {len(variants_map)} entries.")

    def entry_has_translation(entry_id: int) -> bool:
        vs = variants_map.get(entry_id, [])
        return any(
            (v.get('assyrian') or '').strip() or (v.get('arabic') or '').strip()
            for v in vs
        )

    # Find (missing_idx, phantom_idx) pairs
    fixes = []     # (missing_entry, phantom_entry, phantom_variants)
    skipped = []   # entries we can't auto-fix

    for i, entry in enumerate(db_entries):
        if entry_has_translation(entry['id']):
            continue
        if not is_missing_translation(entry):
            continue

        # Look at the next entry in DB order
        if i + 1 >= len(db_entries):
            skipped.append((entry, "last entry, no next"))
            continue

        nxt = db_entries[i + 1]
        nxt_variants = variants_map.get(nxt['id'], [])
        nxt_has_assy = any((v.get('assyrian') or '').strip() for v in nxt_variants)

        if not is_label(nxt['english']):
            skipped.append((entry, f"next entry '{nxt['english']}' is not a label"))
            continue

        if not nxt_has_assy:
            skipped.append((entry, f"phantom '{nxt['english']}' also has no Syriac"))
            continue

        fixes.append((entry, nxt, nxt_variants))

    print(f"\n  Fixable automatically: {len(fixes)}")
    print(f"  Need manual attention: {len(skipped)}")

    # ── Preview ──────────────────────────────────────────────────────────────
    print(f"\n{'[DRY RUN] ' if DRY_RUN else ''}Fixes to apply:")
    for missing, phantom, pvs in fixes[:30]:
        preview = (pvs[0].get('assyrian') or '')[:40]
        print(f"  {missing['english']:30} ← '{phantom['english']}' → {preview!r}…")
    if len(fixes) > 30:
        print(f"  … and {len(fixes) - 30} more")

    if skipped:
        print(f"\nSkipped (need manual lookup in .docx):")
        for entry, reason in skipped:
            print(f"  {entry['id']:>8}  {entry['english']:30}  {reason}")

    if DRY_RUN:
        print('\nDry run complete. No changes made. Run without --dry-run to apply.')
        return

    if not fixes:
        print("\nNothing to fix.")
        return

    # ── Apply fixes ──────────────────────────────────────────────────────────
    print(f"\nApplying {len(fixes)} fixes…")

    updated = 0
    deleted = 0
    errors  = []

    for missing, phantom, phantom_vars in fixes:
        try:
            missing_vars = variants_map.get(missing['id'], [])

            # Sort both by variant number
            phantom_vars_sorted = sorted(phantom_vars, key=lambda v: v.get('number', 1))
            missing_vars_sorted = sorted(missing_vars, key=lambda v: v.get('number', 1))

            if missing_vars_sorted and phantom_vars_sorted:
                # Patch each missing variant in order with the phantom's Syriac/Arabic
                for idx, pv in enumerate(phantom_vars_sorted):
                    assy = (pv.get('assyrian') or '').strip()
                    arab = (pv.get('arabic')   or '').strip()
                    if not assy and not arab:
                        continue

                    if idx < len(missing_vars_sorted):
                        # Update the existing empty variant
                        mv_id = missing_vars_sorted[idx]['id']
                        client.table('variants').update({
                            'assyrian':            assy,
                            'assyrian_normalized': normalize_syriac(assy),
                            'arabic':              arab,
                        }).eq('id', mv_id).execute()
                    else:
                        # Create an extra variant (multi-variant phantom)
                        client.table('variants').insert({
                            'entry_id':            missing['id'],
                            'number':              pv.get('number', idx + 1),
                            'assyrian':            assy,
                            'assyrian_normalized': normalize_syriac(assy),
                            'arabic':              arab,
                            'farsi':               pv.get('farsi'),
                        }).execute()

            # Delete phantom's variants, then the phantom entry
            client.table('variants').delete().eq('entry_id', phantom['id']).execute()
            client.table('entries').delete().eq('id', phantom['id']).execute()

            updated += 1
            deleted += 1

        except Exception as ex:
            errors.append((missing['id'], missing['english'], phantom['english'], str(ex)))

    print(f"\nDone.")
    print(f"  Entries patched:         {updated}")
    print(f"  Phantom entries deleted: {deleted}")

    if errors:
        print(f"\nErrors ({len(errors)}):")
        for eid, eng, phantom_eng, err in errors:
            print(f"  id={eid} '{eng}' ← '{phantom_eng}': {err}")

    if skipped:
        print(f"""
{len(skipped)} entries still need manual translation.
Look each word up in 'data/Bailis Dictionary A-Z.docx' and enter the
Assyrian and Arabic directly in Supabase → Table Editor → variants.
""")


if __name__ == "__main__":
    main()
