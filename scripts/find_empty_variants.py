"""
Find all variants where every translation (assyrian, arabic, farsi) is empty/null
and categorise them so you can fix them manually in Supabase.

Usage:
    set SUPABASE_URL=https://your-project.supabase.co
    set SUPABASE_KEY=your-service-role-key
    python scripts/find_empty_variants.py
"""
import os, sys, re
sys.stdout.reconfigure(encoding='utf-8')
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]


def categorise(english: str, pos: str) -> str:
    eng = english.strip().lower()
    p   = (pos or '').strip().lower()
    if 'see' in p or p.startswith('see'):
        return 'cross-ref'          # legit redirect — pos says "see X"
    if eng == 'see':
        return 'swapped'            # headword/POS got swapped during parsing
    if re.search(r'[^\x00-\x7F]', p):
        return 'garbled-pos'        # non-ASCII bled into the POS field
    if p and p not in ('n', 'n.', 'adj', 'adj.', 'vt', 'vt.', 'vi', 'vi.',
                        'adv', 'adv.', 'prep', 'prep.', 'interj', 'interj.'):
        return 'garbled-pos'        # long/weird POS string
    return 'missing-translation'    # real word, POS looks fine, translation absent


def main():
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("Fetching variants…")
    all_variants, page, page_size = [], 0, 1000
    while True:
        rows = (
            client.table("variants")
            .select("id, entry_id, number, assyrian, arabic, farsi")
            .range(page * page_size, (page + 1) * page_size - 1)
            .execute().data
        )
        if not rows:
            break
        all_variants.extend(rows)
        page += 1
        if len(rows) < page_size:
            break

    print(f"Loaded {len(all_variants)} variants total.")

    # Quick sanity check: count via Supabase directly
    total_db = client.table("variants").select("id", count="exact").execute().count
    print(f"Supabase reports {total_db} total variants.")
    if len(all_variants) != total_db:
        print(f"WARNING: only fetched {len(all_variants)} — pagination may have missed rows.")

    # Filter in Python: all three translation fields empty or null
    empty = [
        v for v in all_variants
        if not (v.get("assyrian") or "").strip()
        and not (v.get("arabic")   or "").strip()
        and not (v.get("farsi")    or "").strip()
    ]

    # Also show counts broken down by field for diagnostics
    empty_assy  = sum(1 for v in all_variants if not (v.get("assyrian") or "").strip())
    empty_arab  = sum(1 for v in all_variants if not (v.get("arabic")   or "").strip())
    empty_farsi = sum(1 for v in all_variants if not (v.get("farsi")    or "").strip())
    print(f"  Empty assyrian: {empty_assy}")
    print(f"  Empty arabic:   {empty_arab}")
    print(f"  Empty farsi:    {empty_farsi}")
    print(f"  All three empty: {len(empty)}")

    if not empty:
        print("No empty-translation variants found — database is clean!")
        return

    # Fetch English headwords
    entry_ids = list({v["entry_id"] for v in empty})
    entries_map = {}
    for i in range(0, len(entry_ids), 500):
        for r in (
            client.table("entries")
            .select("id, english, part_of_speech")
            .in_("id", entry_ids[i:i + 500])
            .execute().data
        ):
            entries_map[r["id"]] = r

    # Categorise and sort
    groups: dict[str, list] = {
        'cross-ref':            [],
        'swapped':              [],
        'garbled-pos':          [],
        'missing-translation':  [],
    }
    for v in empty:
        entry   = entries_map.get(v["entry_id"], {})
        english = entry.get("english", "???")
        pos     = entry.get("part_of_speech") or ""
        cat     = categorise(english, pos)
        groups[cat].append((v["id"], v["entry_id"], v["number"], pos, english))

    labels = {
        'cross-ref':           'Legitimate cross-references (no fix needed)',
        'swapped':             'Headword/POS swapped — "see" became the headword',
        'garbled-pos':         'Garbled POS field (acronym or Arabic/Syriac bled in)',
        'missing-translation': 'Real words with valid POS but no translation',
    }

    total = 0
    for cat, rows in groups.items():
        if not rows:
            continue
        print(f"\n{'═'*70}")
        print(f"  {labels[cat]}  ({len(rows)})")
        print(f"{'═'*70}")
        print(f"  {'var_id':>8}  {'entry_id':>8}  {'#':>2}  {'pos':>12}  english")
        print(f"  {'-'*60}")
        for vid, eid, num, pos, eng in sorted(rows, key=lambda r: r[4]):
            pos_disp = (pos[:30] + '…') if len(pos) > 31 else pos
            print(f"  {vid:>8}  {eid:>8}  {num:>2}  {pos_disp:>12}  {eng}")
        total += len(rows)

    print(f"\n{'═'*70}")
    print(f"  TOTAL empty variants: {total}")
    print(f"{'═'*70}")
    print("""
Fix guide:
  cross-ref           → safe to leave or delete the empty variant row
  swapped             → delete the entry (it's a phantom 'see' headword)
  garbled-pos         → fix the entry's part_of_speech field; add translation
  missing-translation → find the word in the original .docx and add translation
""")


if __name__ == "__main__":
    main()
