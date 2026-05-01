"""
Fix 'swapped' entries: phantom entries where english='see' was created
by the parser misreading a cross-reference line as a new headword.

These entries have no useful content (empty Assyrian AND Arabic on all
variants) and should be deleted entirely.

Usage:
    python scripts/fix_swapped_entries.py           # live run
    python scripts/fix_swapped_entries.py --dry-run # preview only, no changes
"""
import os, sys
sys.stdout.reconfigure(encoding='utf-8')
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

DRY_RUN = '--dry-run' in sys.argv


def main():
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Fetch all entries where english = 'see' (case-insensitive)
    print("Fetching entries where english = 'see'...")
    rows, page, page_size = [], 0, 1000
    while True:
        result = (
            client.table('entries')
            .select('id, english, part_of_speech')
            .ilike('english', 'see')
            .range(page * page_size, (page + 1) * page_size - 1)
            .execute()
        )
        rows.extend(result.data)
        if len(result.data) < page_size:
            break
        page += 1

    print(f"  Found {len(rows)} entries with english='see'.")

    if not rows:
        print("Nothing to do.")
        return

    # For each, fetch variants and check all are empty (assyrian AND arabic)
    candidates = []
    for entry in rows:
        eid = entry['id']
        variants = (
            client.table('variants')
            .select('id, assyrian, arabic')
            .eq('entry_id', eid)
            .execute()
            .data
        )
        all_empty = all(
            not (v.get('assyrian') or '').strip()
            and not (v.get('arabic') or '').strip()
            for v in variants
        )
        if all_empty:
            candidates.append({
                'entry': entry,
                'variants': variants,
            })

    print(f"  {len(candidates)} of those have all-empty variants (safe to delete).")

    if not candidates:
        print("Nothing to delete.")
        return

    print(f"\n{'[DRY RUN] ' if DRY_RUN else ''}Entries to delete:")
    for c in candidates:
        e = c['entry']
        pos = (e.get('part_of_speech') or '').strip()
        print(f"  entry_id={e['id']:>6}  pos={pos!r:30}  variants={len(c['variants'])}")

    if DRY_RUN:
        print('\nDry run complete. No changes made. Run without --dry-run to apply.')
        return

    print(f"\nDeleting {len(candidates)} phantom entries...")

    deleted_variants = 0
    deleted_entries  = 0
    errors = []

    for c in candidates:
        eid = c['entry']['id']
        try:
            # Delete variants first (FK constraint)
            if c['variants']:
                client.table('variants').delete().eq('entry_id', eid).execute()
                deleted_variants += len(c['variants'])
            # Delete the entry
            client.table('entries').delete().eq('id', eid).execute()
            deleted_entries += 1
        except Exception as ex:
            errors.append((eid, str(ex)))

    print(f"\nDone.")
    print(f"  Variants deleted:  {deleted_variants}")
    print(f"  Entries deleted:   {deleted_entries}")

    if errors:
        print(f"\nErrors ({len(errors)}):")
        for eid, err in errors:
            print(f"  entry_id={eid}: {err}")


if __name__ == "__main__":
    main()
