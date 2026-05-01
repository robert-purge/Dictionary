"""
Scan all variants for contaminated assyrian fields — embedded English or Arabic
text that should not be there — and write results to a CSV for manual review.

Each row in the CSV is one contaminated fragment with the surrounding context
so you can decide what to do with it (create a new entry, delete, keep, etc.).

Usage:
    python scripts/scan_contamination.py
    python scripts/scan_contamination.py --out my_review.csv
"""
import csv, os, re, sys
sys.stdout.reconfigure(encoding='utf-8')
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

OUT_FILE = 'data/contamination_review.csv'
for i, arg in enumerate(sys.argv[1:]):
    if arg == '--out' and i + 2 < len(sys.argv):
        OUT_FILE = sys.argv[i + 2]

# ── Detection patterns ────────────────────────────────────────────────────────

# Arabic letters (not just punctuation like ؛ ، — those are fine in Syriac text)
ARABIC_WORD_RE = re.compile(
    r'[ء-غف-ي]'       # Arabic letter
    r'[ء-غف-ي\s]{2,}' # followed by more letters/spaces
)

# Latin / English text — 2+ consecutive Latin characters
LATIN_RE = re.compile(r'[a-zA-Z][a-zA-Z\s\-\'\.]{1,}')

# Syriac letters — to detect the script context around fragments
SYRIAC_RE = re.compile(r'[܀-ݏ]')


def find_fragments(text: str) -> list[dict]:
    """
    Return a list of contamination fragments found in text.
    Each item: { type, fragment, start, end }
    """
    found = []

    for m in ARABIC_WORD_RE.finditer(text):
        frag = m.group().strip()
        if len(frag) >= 3 and SYRIAC_RE.search(text):  # only flag if Syriac also present
            found.append({
                'type': 'arabic',
                'fragment': frag,
                'start': m.start(),
                'end': m.end(),
            })

    for m in LATIN_RE.finditer(text):
        frag = m.group().strip()
        if len(frag) >= 2:
            found.append({
                'type': 'latin',
                'fragment': frag,
                'start': m.start(),
                'end': m.end(),
            })

    # Deduplicate overlapping matches, keep longest
    found.sort(key=lambda x: (x['start'], -(x['end'] - x['start'])))
    deduped = []
    last_end = -1
    for f in found:
        if f['start'] >= last_end:
            deduped.append(f)
            last_end = f['end']

    return deduped


def context_around(text: str, start: int, end: int, window: int = 40) -> tuple[str, str]:
    """Return the Syriac text immediately before and after a fragment."""
    before = text[max(0, start - window):start].strip()
    after  = text[end:end + window].strip()
    return before, after


def main():
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # ── Fetch all variants ────────────────────────────────────────────────────
    print("Fetching variants...")
    all_variants, page, page_size = [], 0, 1000
    while True:
        rows = (
            client.table('variants')
            .select('id, entry_id, assyrian, arabic')
            .range(page * page_size, (page + 1) * page_size - 1)
            .execute()
            .data
        )
        all_variants.extend(rows)
        if len(rows) < page_size:
            break
        page += 1

    print(f"  Loaded {len(all_variants)} variants.")

    # ── Fetch entries for headword context ────────────────────────────────────
    print("Fetching entries...")
    all_entries, page = [], 0
    while True:
        rows = (
            client.table('entries')
            .select('id, english, part_of_speech')
            .range(page * page_size, (page + 1) * page_size - 1)
            .execute()
            .data
        )
        all_entries.extend(rows)
        if len(rows) < page_size:
            break
        page += 1

    entries_map = {e['id']: e for e in all_entries}
    print(f"  Loaded {len(all_entries)} entries.")

    # ── Scan ──────────────────────────────────────────────────────────────────
    print("Scanning for contamination...")
    results = []

    for v in all_variants:
        assyrian = (v.get('assyrian') or '').strip()
        if not assyrian:
            continue

        fragments = find_fragments(assyrian)
        if not fragments:
            continue

        entry = entries_map.get(v['entry_id'], {})

        for f in fragments:
            before, after = context_around(assyrian, f['start'], f['end'])
            results.append({
                'variant_id':        v['id'],
                'entry_id':          v['entry_id'],
                'english':           entry.get('english', '?'),
                'part_of_speech':    entry.get('part_of_speech', ''),
                'contamination_type': f['type'],
                'extracted_fragment': f['fragment'],
                'syriac_before':     before,
                'syriac_after':      after,
                'full_assyrian':     assyrian,
                'arabic_field':      (v.get('arabic') or ''),
                # ── for you to fill in ──────────────────────────────────────
                'action':            '',   # new_entry / delete / keep / move_to_arabic
                'notes':             '',
            })

    print(f"  Found {len(results)} contaminated fragments across "
          f"{len({r['variant_id'] for r in results})} variants.")

    # ── Write CSV ─────────────────────────────────────────────────────────────
    if not results:
        print("No contamination found.")
        return

    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)

    with open(OUT_FILE, 'w', newline='', encoding='utf-8-sig') as f:
        # utf-8-sig writes the BOM so Excel opens it correctly
        writer = csv.DictWriter(f, fieldnames=list(results[0].keys()))
        writer.writeheader()
        writer.writerows(results)

    print(f"\nSaved to {OUT_FILE}")
    print("""
Columns:
  variant_id / entry_id / english  — identifies the source entry
  contamination_type                — 'latin' (English) or 'arabic'
  extracted_fragment                — the foreign text found
  syriac_before / syriac_after      — Syriac context around the fragment
  full_assyrian                     — the complete original field
  arabic_field                      — the current arabic translation
  action                            — fill this in:
      new_entry     → fragment becomes its own English entry with syriac_after as translation
      delete        → fragment is noise, remove it
      keep          → fragment belongs in the assyrian field as-is
      move_to_arabic → fragment is Arabic that belongs in the arabic field
  notes                             — anything else
""")


if __name__ == '__main__':
    main()
