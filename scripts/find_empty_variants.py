"""
Find all variants where every translation (assyrian, arabic, farsi) is empty or null.
Prints a table so you can review and fix them manually in Supabase.

Usage:
    set SUPABASE_URL=...
    set SUPABASE_KEY=...
    python scripts/find_empty_variants.py
"""
import os, sys
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]


def main():
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Fetch all variants with their entry (paginate to handle large tables)
    print("Fetching variants…")
    all_variants = []
    page = 0
    page_size = 1000
    while True:
        rows = (
            client.table("variants")
            .select("id, entry_id, number, assyrian, arabic, farsi")
            .range(page * page_size, (page + 1) * page_size - 1)
            .execute()
            .data
        )
        if not rows:
            break
        all_variants.extend(rows)
        page += 1
        if len(rows) < page_size:
            break

    print(f"Loaded {len(all_variants)} variants total.")

    # Filter: all translation fields empty or null
    empty = [
        v for v in all_variants
        if not (v.get("assyrian") or "").strip()
        and not (v.get("arabic") or "").strip()
        and not (v.get("farsi") or "").strip()
    ]

    if not empty:
        print("No empty-translation variants found — database is clean!")
        return

    print(f"\nFound {len(empty)} variant(s) with no translations:\n")

    # Collect unique entry_ids to fetch English headwords in one query
    entry_ids = list({v["entry_id"] for v in empty})
    entries_map = {}
    for i in range(0, len(entry_ids), 500):
        chunk = entry_ids[i:i + 500]
        rows = (
            client.table("entries")
            .select("id, english, part_of_speech")
            .in_("id", chunk)
            .execute()
            .data
        )
        for r in rows:
            entries_map[r["id"]] = r

    # Print results sorted by English word
    empty.sort(key=lambda v: (entries_map.get(v["entry_id"], {}).get("english", ""), v["number"]))

    print(f"{'variant_id':>10}  {'entry_id':>10}  {'#':>2}  {'pos':>8}  english")
    print("-" * 70)
    for v in empty:
        entry = entries_map.get(v["entry_id"], {})
        english = entry.get("english", "???")
        pos     = entry.get("part_of_speech") or ""
        print(f"{v['id']:>10}  {v['entry_id']:>10}  {v['number']:>2}  {pos:>8}  {english}")

    print(f"\nTotal: {len(empty)} empty variants across {len(entry_ids)} entries.")
    print("\nTo fix: go to Supabase > Table Editor > variants, filter by the IDs above,")
    print("and fill in the missing translations — or delete the variant row if it's a")
    print("parsing artefact with no actual content.")


if __name__ == "__main__":
    main()
