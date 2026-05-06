"""
Detect and auto-correct POS mismatches in the variants table.

Background
----------
The original dictionary stores part_of_speech at the entry level (e.g., "vt."),
but individual variants under that entry sometimes contain Syriac words of a
different part of speech. The classic case: "abandon vt." has 3 verb variants
and 1 noun variant.

Detection method
----------------
The Syriac text uses inline grammatical markers in parentheses after each word:
  (ܕ.root)   — masculine noun (ܕܸܟ̣ܪܵܐ)
  (ܢ.root)   — feminine noun (ܢܩܒ̣ܵܐ)
  (ܕ.ܢ.root) — both genders

Verb forms never carry these markers. So: if a variant's Syriac text is split
into ؛-separated tokens and ≥ N of them have (ܕ. or (ܢ. markers, we can infer
the variant is nominal/adjectival rather than verbal.

Confidence thresholds
---------------------
  high   (noun_fraction >= 0.8) → auto-correct to 'n.' in the database
  medium (noun_fraction >= 0.5) → written to CSV for manual review only

The script also flags entries whose POS already signals multiple categories
(e.g., "adv. adj.") — those are correct and are skipped.

Output
------
  data/pos_mismatches.csv  — all detected mismatches with English context,
                             noun_fraction, confidence, and suggested POS

Usage
-----
    python scripts/v2_detect_pos.py --dry-run   # report only, no writes
    python scripts/v2_detect_pos.py             # auto-correct high-confidence
"""

import csv
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_KEY"]
DRY_RUN = '--dry-run' in sys.argv

# Syriac gender markers: parenthetical starting with ܕ. or ܢ. (ASCII period)
# These indicate noun/adjective grammatical categories.
GENDER_MARKER_RE = re.compile(r'\([ܕܢ]\.')

# Entry POS values that are purely verbal — mismatches only matter here.
# Multi-category POS like "adv. adj" are intentionally mixed and skipped.
# Normalized (lowercase, no dots, no spaces) to handle DB inconsistencies.
VERB_ONLY_POS_NORMALIZED = {'vt', 'vi', 'vtvi', 'vivt'}

def normalize_pos(pos: str) -> str:
    return pos.lower().replace('.', '').replace(' ', '')

HIGH_CONFIDENCE  = 0.80   # auto-correct
MEDIUM_CONFIDENCE = 0.50  # CSV only


def noun_fraction(assyrian: str) -> float:
    """Return the fraction of ؛-separated tokens that carry Syriac gender markers."""
    tokens = [t.strip() for t in re.split(r'[؛;]', assyrian) if t.strip()]
    if not tokens:
        return 0.0
    marked = sum(1 for t in tokens if GENDER_MARKER_RE.search(t))
    return marked / len(tokens)


def fetch_all(client, table: str, columns: str) -> list[dict]:
    rows, page, size = [], 0, 1000
    while True:
        batch = (
            client.table(table)
            .select(columns)
            .range(page * size, (page + 1) * size - 1)
            .execute()
            .data
        )
        rows.extend(batch)
        if len(batch) < size:
            break
        page += 1
    return rows


def main():
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("Fetching variants...")
    variants = fetch_all(client, 'variants', 'id, entry_id, assyrian, part_of_speech')
    print(f"  {len(variants)} variants loaded.")

    print("Fetching entries...")
    entry_rows = fetch_all(client, 'entries', 'id, english, part_of_speech')
    entries = {r['id']: r for r in entry_rows}
    print(f"  {len(entries)} entries loaded.")

    # ── Diagnostics ──────────────────────────────────────────────────────────
    sample_variants = variants[:5]
    print("\nDiagnostics — first 5 variants:")
    for v in sample_variants:
        entry = entries.get(v['entry_id'], {})
        print(f"  variant id={v['id']} entry_id={v['entry_id']} "
              f"entry_pos={entry.get('part_of_speech')!r} "
              f"english={entry.get('english')!r}")

    verb_variants = [v for v in variants
                     if normalize_pos((entries.get(v['entry_id'], {}).get('part_of_speech') or '').strip())
                     in VERB_ONLY_POS_NORMALIZED]
    print(f"\nVerb-entry variants (normalized POS in {VERB_ONLY_POS_NORMALIZED}): {len(verb_variants)}")
    if verb_variants:
        sample = verb_variants[:3]
        print("  Sample verb variants + noun_fraction:")
        for v in sample:
            assyrian = (v.get('assyrian') or '').strip()
            entry = entries.get(v['entry_id'], {})
            print(f"    id={v['id']} english={entry.get('english')!r} "
                  f"pos={entry.get('part_of_speech')!r} "
                  f"noun_frac={noun_fraction(assyrian):.2f} "
                  f"assyrian_start={assyrian[:60]!r}")
    print()
    # ─────────────────────────────────────────────────────────────────────────

    mismatches = []
    high_ids   = []   # variant ids to auto-correct

    for v in variants:
        assyrian = (v.get('assyrian') or '').strip()
        if not assyrian:
            continue

        entry = entries.get(v['entry_id'], {})
        pos = (entry.get('part_of_speech') or '').strip()
        if normalize_pos(pos) not in VERB_ONLY_POS_NORMALIZED:
            continue   # not a verb entry — skip

        frac = noun_fraction(assyrian)
        if frac < MEDIUM_CONFIDENCE:
            continue   # no mismatch signal

        confidence = 'high' if frac >= HIGH_CONFIDENCE else 'medium'

        mismatches.append({
            'variant_id':    v['id'],
            'entry_id':      v['entry_id'],
            'english':       entry.get('english', ''),
            'current_pos':   pos,
            'noun_fraction': round(frac, 2),
            'confidence':    confidence,
            'suggested_pos': 'n',
            'assyrian_preview': assyrian[:100],
        })

        if confidence == 'high':
            high_ids.append(v['id'])

    high_count   = sum(1 for m in mismatches if m['confidence'] == 'high')
    medium_count = sum(1 for m in mismatches if m['confidence'] == 'medium')

    print(f"\nDetected {len(mismatches)} POS mismatches in verb entries:")
    print(f"  High confidence   (>= {HIGH_CONFIDENCE:.0%}): {high_count}  → will auto-correct")
    print(f"  Medium confidence (>= {MEDIUM_CONFIDENCE:.0%}): {medium_count} → review CSV only")

    # Write review CSV (always, even in dry-run)
    csv_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'pos_mismatches.csv')
    csv_path = os.path.normpath(csv_path)
    if mismatches:
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=list(mismatches[0].keys()))
            writer.writeheader()
            writer.writerows(mismatches)
        print(f"\nReview CSV written: {csv_path}")
    else:
        print("\nNo mismatches detected.")

    if DRY_RUN:
        print("\nDry run — no database writes.")
        return

    if not high_ids:
        print("\nNo high-confidence corrections to apply.")
        return

    # Auto-correct high-confidence mismatches
    print(f"\nApplying {len(high_ids)} auto-corrections...")
    batch_size = 100
    for i in range(0, len(high_ids), batch_size):
        batch = high_ids[i:i + batch_size]
        client.table('variants').update({'part_of_speech': 'n'}).in_('id', batch).execute()
        print(f"  {min(i + batch_size, len(high_ids))}/{len(high_ids)} updated...")

    print(f"\n✓ Done. {len(high_ids)} variants corrected to 'n.'")
    print(f"  Review {medium_count} medium-confidence cases in: {csv_path}")
    print("\nNext step: run v2_propagate_pos.sql to push POS into syriac_words.")


if __name__ == '__main__':
    main()
